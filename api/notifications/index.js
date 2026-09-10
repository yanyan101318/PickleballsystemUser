import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const limit = parseInt(req.query.limit || '50', 10);
  const { unreadOnly } = req.query;

  const pool = getPool();
  try {
    // Ensure table exists just in case (though it should be created by now)
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

    let queryStr = 'SELECT * FROM notifications ';
    const params = [];
    if (unreadOnly === 'true') {
      queryStr += 'WHERE is_read = false ';
    }
    queryStr += 'ORDER BY created_at DESC LIMIT $1';
    params.push(limit);

    const result = await pool.query(queryStr, params);
    return res.json(result.rows.map(row => ({
      id: row.id, type: row.type, title: row.title,
      message: row.message, data: row.data,
      isRead: row.is_read, is_read: row.is_read,
      createdAt: row.created_at, created_at: row.created_at
    })));
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
}
