import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pool = getPool();
  try {
    const result = await pool.query('SELECT COUNT(*)::int AS count FROM notifications WHERE is_read = false');
    return res.json({ unreadCount: result.rows[0]?.count || 0 });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ error: 'Failed to fetch unread count' });
  }
}
