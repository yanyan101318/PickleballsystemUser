import { getPool } from '../_lib/db.js';
import { protect } from '../_lib/auth.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const pool = getPool();
  try {
    const bookings = await pool.query(
      'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC',
      [decoded.uid]
    );
    return res.json(bookings.rows.map(b => ({
      id: b.id, userId: b.user_id, playerName: b.player_name,
      contactNumber: b.contact_number, email: b.email,
      courtId: b.court_id, courtName: b.court_name,
      date: b.booking_date, timeSlot: b.time_slot,
      startTime: b.start_time, endTime: b.end_time,
      duration: b.duration, players: b.players, status: b.status,
      totalAmount: b.total_amount, amountPaid: b.amount_paid,
      remainingBalance: b.remaining_balance, hourlyRate: b.hourly_rate,
      paymentPlan: b.payment_plan, paymentMethod: b.payment_method,
      customerPaymentStatus: b.customer_payment_status,
      cashReceived: b.cash_received, change: b.change,
      promoCode: b.promo_code, equipment: b.equipment,
      notes: b.notes, receiptUrl: b.receipt_url,
      latestReceiptId: b.latest_receipt_id, lastPrintedBy: b.last_printed_by,
      createdAt: b.created_at, updatedAt: b.updated_at,
    })));
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
