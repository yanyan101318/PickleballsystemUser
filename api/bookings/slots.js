import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { courtIds, date } = req.query;
  if (!courtIds || !date) return res.json([]);

  const ids = courtIds.split(',');
  const pool = getPool();
  try {
    const result = await pool.query(
      `SELECT time_slot, duration, status FROM bookings
       WHERE court_id::text = ANY($1::text[]) AND booking_date = $2
       AND status IN ('pending','approved','Pending','Approved','confirmed','Confirmed')`,
      [ids, date]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error('Error fetching slots:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
