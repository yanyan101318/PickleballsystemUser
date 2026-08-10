import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get all courts
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courts ORDER BY id ASC');
    const courts = result.rows.map(court => ({
      id: court.id,
      name: court.name,
      description: court.description,
      pricePerHour: court.price_per_hour,
      amenities: court.amenities,
      isActive: court.is_active,
      activeStartTime: court.active_start_time,
      activeEndTime: court.active_end_time,
      baseStatus: court.base_status,
      overrideStatus: court.override_status,
      overrideExpiresAt: court.override_expires_at,
      qrCodeImage: court.qr_code_image,
      createdAt: court.created_at
    }));
    res.json(courts);
  } catch (error) {
    console.error('Error fetching courts:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single court
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM courts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Court not found' });
    }
    const court = result.rows[0];
    res.json({
      id: court.id,
      name: court.name,
      description: court.description,
      pricePerHour: court.price_per_hour,
      amenities: court.amenities,
      isActive: court.is_active,
      activeStartTime: court.active_start_time,
      activeEndTime: court.active_end_time,
      baseStatus: court.base_status,
      overrideStatus: court.override_status,
      overrideExpiresAt: court.override_expires_at,
      qrCodeImage: court.qr_code_image,
      createdAt: court.created_at
    });
  } catch (error) {
    console.error('Error fetching court:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
