import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get all inventory items
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_items ORDER BY category ASC, name ASC');
    const items = result.rows.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      notes: item.notes,
      type: item.type,
      price: item.price,
      pricePerHour: item.price_per_hour,
      availableQty: item.available_qty,
      totalQty: item.total_qty,
      overdueFinePerHour: item.overdue_fine_per_hour,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));
    res.json(items);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
