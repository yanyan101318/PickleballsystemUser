import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get all inventory items
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    let query = 'SELECT * FROM inventory_items';
    const params = [];

    if (type) {
      const lowerType = type.toLowerCase();
      if (lowerType === 'rent' || lowerType === 'rental') {
        query += " WHERE (LOWER(type) = 'rental' OR LOWER(type) = 'rent')";
      } else if (lowerType === 'sale' || lowerType === 'for_sale') {
        query += " WHERE (LOWER(type) = 'sale' OR LOWER(type) = 'for_sale')";
      } else {
        query += ' WHERE LOWER(type) = $1';
        params.push(lowerType);
      }
    }

    query += ' ORDER BY category ASC, name ASC';
    const result = await pool.query(query, params);

    const items = result.rows.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      notes: item.notes,
      type: item.type,
      price: item.price ?? item.sale_price ?? 0,
      pricePerHour: item.price_per_hour ?? 0,
      availableQty: item.available_qty ?? 0,
      totalQty: item.total_qty ?? 0,
      overdueFinePerHour: item.overdue_fine_per_hour ?? 0,
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

