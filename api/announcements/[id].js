import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

const mapAnn = (a) => ({
  id: a.id, title: a.title, message: a.message,
  type: a.type, isActive: a.is_active,
  createdBy: a.created_by, createdAt: a.created_at,
});

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const { id } = req.query;
  const pool = getPool();

  if (req.method === 'PATCH') {
    const { title, message, type, is_active } = req.body || {};
    try {
      const result = await pool.query(
        `UPDATE announcements
         SET title = COALESCE($1,title), message = COALESCE($2,message),
             type = COALESCE($3,type), is_active = COALESCE($4,is_active),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5 RETURNING *`,
        [title, message, type, is_active, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Announcement not found' });
      return res.json(mapAnn(result.rows[0]));
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const result = await pool.query('DELETE FROM announcements WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Announcement not found' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
