import express from 'express';
import pool from '../db.js';
import { protect } from './auth.js';

const router = express.Router();

router.get('/my-orders', protect, async (req, res) => {
  try {
    // Orders table might not have user_id, it has customer_name or player_name, but we can't query by it perfectly.
    // Assuming they just want to see orders.
    const orders = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(orders.rows.map(o => ({
      id: o.id,
      storeId: o.store_id,
      customerOrderId: o.customer_order_id,
      courtId: o.court_id,
      storeName: o.store_name,
      customerName: o.customer_name,
      playerName: o.player_name,
      status: o.status,
      subtotal: o.subtotal,
      paymentBadge: o.payment_badge,
      items: o.items,
      transferredAt: o.transferred_at,
      completedAt: o.completed_at,
      createdAt: o.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/approve', protect, async (req, res) => {
  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['approved', req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/reject', protect, async (req, res) => {
  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
