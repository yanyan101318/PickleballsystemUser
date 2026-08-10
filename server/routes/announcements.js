import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get active announcements
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM announcements WHERE is_active = true ORDER BY created_at DESC");
    res.json(result.rows.map(a => ({
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
      isActive: a.is_active,
      createdAt: a.created_at
    })));
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
