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
    const orders = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    return res.json(orders.rows.map(o => ({
      id: o.id, storeId: o.store_id, customerOrderId: o.customer_order_id,
      courtId: o.court_id, storeName: o.store_name, customerName: o.customer_name,
      playerName: o.player_name, status: o.status, subtotal: o.subtotal,
      paymentBadge: o.payment_badge, items: o.items, transferredAt: o.transferred_at,
      completedAt: o.completed_at, createdAt: o.created_at
    })));
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
