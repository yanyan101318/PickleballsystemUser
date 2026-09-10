import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Get announcements (active for users, all if ?all=true for admin)
router.get('/', async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const queryText = showAll
      ? "SELECT * FROM announcements ORDER BY created_at DESC"
      : "SELECT * FROM announcements WHERE is_active = true ORDER BY created_at DESC";
    
    const result = await pool.query(queryText);
    res.json(result.rows.map(a => ({
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
      isActive: a.is_active,
      createdBy: a.created_by,
      createdAt: a.created_at
    })));
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new announcement (Admin)
router.post('/', async (req, res) => {
  try {
    const { title, message, type, is_active, created_by } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const result = await pool.query(
      `INSERT INTO announcements (title, message, type, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title, message, type || 'info', is_active !== false, created_by || 'Admin']
    );

    const a = result.rows[0];
    const newAnnouncement = {
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
      isActive: a.is_active,
      createdBy: a.created_by,
      createdAt: a.created_at
    };

    // Emit broadcast socket event to all connected clients
    if (req.io) {
      req.io.emit('new_announcement', newAnnouncement);
    }

    res.status(201).json(newAnnouncement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update announcement
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, message, type, is_active } = req.body;

    const result = await pool.query(
      `UPDATE announcements
       SET title = COALESCE($1, title),
           message = COALESCE($2, message),
           type = COALESCE($3, type),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [title, message, type, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const a = result.rows[0];
    const updated = {
      id: a.id,
      title: a.title,
      message: a.message,
      type: a.type,
      isActive: a.is_active,
      createdBy: a.created_by,
      createdAt: a.created_at
    };

    if (req.io) {
      req.io.emit('announcement_updated', updated);
      if (updated.isActive) {
        req.io.emit('new_announcement', updated);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete announcement
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    if (req.io) {
      req.io.emit('announcement_deleted', id);
    }

    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

