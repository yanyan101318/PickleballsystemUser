import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

const mapAnn = (a) => ({
  id: a.id, title: a.title, message: a.message,
  type: a.type, isActive: a.is_active,
  createdBy: a.created_by, createdAt: a.created_at,
});

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const pool = getPool();

  if (req.method === 'GET') {
    try {
      const result = await pool.query(
        'SELECT * FROM announcements WHERE is_active = true ORDER BY created_at DESC'
      );
      return res.json(result.rows.map(mapAnn));
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'POST') {
    const { title, message, type, is_active, created_by } = req.body || {};
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });
    try {
      const result = await pool.query(
        `INSERT INTO announcements (title, message, type, is_active, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [title, message, type || 'info', is_active !== false, created_by || 'Admin']
      );
      return res.status(201).json(mapAnn(result.rows[0]));
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
