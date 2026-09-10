import { getPool } from '../_lib/db.js';
import { protect } from '../_lib/auth.js';
import { cors } from '../_lib/cors.js';

const convertSlotToMinutes = (slot) => {
  if (!slot) return 0;
  const [time, mer] = slot.split(' ');
  let [h, m] = time.split(':').map(Number);
  if (mer === 'PM' && h !== 12) h += 12;
  if (mer === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const pool = getPool();
  const client = await pool.connect();
  try {
    const b = req.body;
    await client.query('BEGIN');
    await client.query('LOCK TABLE bookings IN EXCLUSIVE MODE');

    const newBookingIds = [];
    let isFirstDoc = true;

    for (const occ of b.occurrences) {
      for (const c of b.selectedCourts) {
        // Conflict check
        const conflicts = await client.query(
          `SELECT time_slot, duration FROM bookings
           WHERE court_id::text = $1::text AND booking_date = $2
           AND status IN ('pending','approved','Pending','Approved','confirmed','Confirmed')`,
          [c.id, occ.date]
        );
        const newStart = convertSlotToMinutes(occ.timeSlot);
        const newEnd = newStart + occ.duration * 60;
        for (const row of conflicts.rows) {
          const eStart = convertSlotToMinutes(row.time_slot);
          const eEnd = eStart + (parseFloat(row.duration) || 1) * 60;
          if (newStart < eEnd && newEnd > eStart) {
            throw new Error(`Time slot overlaps with an existing booking on ${occ.date} for court ${c.name}.`);
          }
        }

        const id = 'bkg_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
        const equipment = isFirstDoc ? b.equipmentLines : [];

        // Ensure user row exists (FK safety)
        await client.query(
          `INSERT INTO users (id, email, display_name, phone) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
          [decoded.uid, `user_${decoded.uid}@placeholder.com`, b.playerName || 'Guest', b.phone || '']
        );

        await client.query(
          `INSERT INTO bookings (
             id, user_id, court_id, court_name, booking_date, time_slot, duration,
             player_name, contact_number, notes, status, total_amount, promo_code, equipment
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [
            id, decoded.uid, c.id, c.name, occ.date, occ.timeSlot, occ.duration,
            b.playerName, b.phone, b.notes, 'pending',
            isFirstDoc ? b.totalAmount : 0, b.promoCode, JSON.stringify(equipment),
          ]
        );
        newBookingIds.push(id);
        isFirstDoc = false;
      }
    }

    // Payment record
    const paymentId = 'pay_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    await client.query(
      `INSERT INTO payments (id, booking_id, user_id, name, amount, payment_status, payment_image_url, promo_code, method, payment_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_DATE)`,
      [
        paymentId, newBookingIds[0], decoded.uid, b.playerName, b.totalAmount,
        b.paymentRef ? 'completed' : 'pending', b.paymentImgUrl, b.promoCode, 'manual',
      ]
    );

    // Decrement inventory & borrow record
    if (b.equipmentLines?.length > 0) {
      for (const eq of b.equipmentLines) {
        await client.query(
          `UPDATE inventory_items SET available_qty = available_qty - $1 WHERE id = $2`,
          [eq.qty, eq.id]
        );
      }
      const borrowId = 'brw_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
      await client.query(
        `INSERT INTO borrow_records (id, borrower_name, items, status, expected_return_at)
         VALUES ($1,$2,$3::jsonb,'borrowed', NOW() + interval '1 hour' * $4)`,
        [borrowId, b.playerName, JSON.stringify(b.equipmentLines), b.occurrences[0].duration]
      );
    }

    // Notification record
    const notifId = 'notif_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    const courtNamesStr = b.selectedCourts?.map(c => c.name).join(', ') || 'Court';
    const firstOcc = b.occurrences?.[0] || {};
    const notifMsg = `New booking from ${b.playerName || 'Guest'} for ${courtNamesStr} on ${firstOcc.date || ''} (${firstOcc.timeSlot || ''})`;
    const notifData = { bookingIds: newBookingIds, playerName: b.playerName, courtName: courtNamesStr, date: firstOcc.date, timeSlot: firstOcc.timeSlot, totalAmount: b.totalAmount };
    try {
      await client.query(
        `INSERT INTO notifications (id, type, title, message, data, is_read, created_at) VALUES ($1,$2,$3,$4,$5::jsonb,false,NOW())`,
        [notifId, 'booking', 'New Booking Received', notifMsg, JSON.stringify(notifData)]
      );
    } catch (notifErr) {
      console.error('Failed to insert notification:', notifErr.message);
    }

    await client.query('COMMIT');
    return res.json({ success: true, bookingIds: newBookingIds });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk booking:', error);
    return res.status(400).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
}
