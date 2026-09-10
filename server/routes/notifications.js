import express from 'express';
import pool from '../db.js';

const router = express.Router();

// Ensure notifications table exists helper
const ensureTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) DEFAULT 'booking',
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } catch (err) {
    console.error('Error ensuring notifications table:', err.message);
  }
};
ensureTable();

// GET /api/notifications - Fetch all notifications
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const { unreadOnly } = req.query;

    let queryStr = 'SELECT * FROM notifications ';
    const params = [];

    if (unreadOnly === 'true') {
      queryStr += 'WHERE is_read = false ';
    }

    queryStr += 'ORDER BY created_at DESC LIMIT $1';
    params.push(limit);

    const result = await pool.query(queryStr, params);

    const formatted = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: row.data,
      isRead: row.is_read,
      is_read: row.is_read,
      createdAt: row.created_at,
      created_at: row.created_at
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /api/notifications/unread-count - Fetch count of unread notifications
router.get('/unread-count', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = false');
    res.json({ unreadCount: result.rows[0]?.count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /api/notifications/mark-read - Mark notifications as read
router.patch('/mark-read', async (req, res) => {
  try {
    const { id } = req.body || {};
    if (id) {
      await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    } else {
      await pool.query('UPDATE notifications SET is_read = true WHERE is_read = false');
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// PATCH /api/notifications/:id/read - Mark a specific notification as read
router.patch('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

export default router;
