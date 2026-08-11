import express from 'express';
import pool from '../db.js';
import { protect } from './auth.js';

const router = express.Router();

router.get('/my-bookings', protect, async (req, res) => {
  try {
    const bookings = await pool.query('SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC', [req.userUid]);
    res.json(bookings.rows.map(b => ({
      id: b.id,
      userId: b.user_id,
      playerName: b.player_name,
      contactNumber: b.contact_number,
      email: b.email,
      courtId: b.court_id,
      courtName: b.court_name,
      date: b.booking_date,
      timeSlot: b.time_slot,
      startTime: b.start_time,
      endTime: b.end_time,
      duration: b.duration,
      players: b.players,
      status: b.status,
      totalAmount: b.total_amount,
      amountPaid: b.amount_paid,
      remainingBalance: b.remaining_balance,
      hourlyRate: b.hourly_rate,
      paymentPlan: b.payment_plan,
      paymentMethod: b.payment_method,
      customerPaymentStatus: b.customer_payment_status,
      cashReceived: b.cash_received,
      change: b.change,
      promoCode: b.promo_code,
      equipment: b.equipment,
      notes: b.notes,
      receiptUrl: b.receipt_url,
      latestReceiptId: b.latest_receipt_id,
      lastPrintedBy: b.last_printed_by,
      createdAt: b.created_at,
      updatedAt: b.updated_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get booked slots for specific courts on a date
router.get('/slots', async (req, res) => {
  try {
    const { courtIds, date } = req.query;
    if (!courtIds || !date) return res.json([]);
    
    const ids = courtIds.split(',');
    const result = await pool.query(
      `SELECT time_slot, duration, status FROM bookings 
       WHERE court_id = ANY($1::varchar[]) AND booking_date = $2 
       AND status IN ('pending', 'approved', 'Pending', 'Approved', 'confirmed', 'Confirmed')`,
      [ids, date]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/bulk', protect, async (req, res) => {
  const client = await pool.connect();
  try {
    const b = req.body;
    await client.query('BEGIN');
    await client.query('LOCK TABLE bookings IN EXCLUSIVE MODE');
    
    const newBookingIds = [];
    let isFirstDoc = true;
    
    const convertSlotToMinutes = (slot) => {
      if (!slot) return 0;
      const [time, mer] = slot.split(" ");
      let [h, m] = time.split(":").map(Number);
      if (mer === "PM" && h !== 12) h += 12;
      if (mer === "AM" && h === 12) h = 0;
      return h * 60 + m;
    };
    
    // 1. Insert Bookings
    for (const occ of b.occurrences) {
      for (const c of b.selectedCourts) {
        
        // Conflict check
        const conflictResult = await client.query(
          `SELECT id, time_slot, duration FROM bookings 
           WHERE court_id = $1 AND booking_date = $2 
           AND status IN ('pending', 'approved', 'Pending', 'Approved', 'confirmed', 'Confirmed')`,
          [c.id, occ.date]
        );
        
        const newStart = convertSlotToMinutes(occ.timeSlot);
        const newEnd = newStart + occ.duration * 60;
        
        for (const row of conflictResult.rows) {
          const existingStart = convertSlotToMinutes(row.time_slot);
          const existingEnd = existingStart + (parseFloat(row.duration) || 1) * 60;
          
          if (newStart < existingEnd && newEnd > existingStart) {
            throw new Error(`Time slot overlaps with an existing booking on ${occ.date} for court ${c.name}.`);
          }
        }

        const id = 'bkg_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
        
        // Equipment details only on the first doc
        const isFirst = isFirstDoc;
        const equipment = isFirst ? b.equipmentLines : [];

        await client.query(
          `INSERT INTO bookings (
            id, user_id, court_id, court_name, booking_date, time_slot, duration, 
            player_name, contact_number, notes, status, total_amount, promo_code, equipment
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::text[])`,
          [
            id, req.userUid, c.id, c.name, occ.date, occ.timeSlot, occ.duration,
            b.playerName, b.phone, b.notes, 'pending', 
            isFirst ? b.totalAmount : 0, b.promoCode, equipment.map(e => JSON.stringify(e))
          ]
        );
        newBookingIds.push(id);
        isFirstDoc = false;
      }
    }

    // 2. Insert Payment
    const paymentId = 'pay_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    await client.query(
      `INSERT INTO payments (
        id, booking_id, user_id, name, amount, payment_status, 
        payment_image_url, promo_code, method, payment_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_DATE)`,
      [
        paymentId, 
        newBookingIds[0], 
        req.userUid, 
        b.playerName, 
        b.totalAmount, 
        b.paymentRef ? 'completed' : 'pending',
        b.paymentImgUrl, 
        b.promoCode, 
        b.paymentRef ? 'manual' : 'manual'
      ]
    );

    // 3. Decrement Inventory
    if (b.equipmentLines && b.equipmentLines.length > 0) {
      for (const eq of b.equipmentLines) {
        await client.query(
          `UPDATE inventory_items 
           SET available_qty = available_qty - $1 
           WHERE id = $2`,
          [eq.qty, eq.id]
        );
      }

      // 4. Create Borrow Record
      const borrowId = 'brw_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
      await client.query(
        `INSERT INTO borrow_records (
          id, borrower_name, items, status, expected_return_at
        ) VALUES ($1, $2, $3, 'borrowed', NOW() + interval '1 hour' * $4)`,
        [
          borrowId, 
          b.playerName, 
          JSON.stringify(b.equipmentLines),
          b.occurrences[0].duration
        ]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, bookingIds: newBookingIds });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in bulk booking:', error);
    res.status(400).json({ error: error.message || 'Server error' });
  } finally {
    client.release();
  }
});

export default router;
