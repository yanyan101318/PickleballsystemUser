import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.body || {};
  const pool = getPool();
  try {
    if (id) {
      await pool.query('UPDATE notifications SET is_read = true WHERE id = $1', [id]);
    } else {
      await pool.query('UPDATE notifications SET is_read = true WHERE is_read = false');
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
}
