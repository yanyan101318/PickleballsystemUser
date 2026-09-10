import { getPool } from '../../../_lib/db.js';
import { protect } from '../../../_lib/auth.js';
import { cors } from '../../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const { id } = req.query;
  const pool = getPool();
  try {
    const check = await pool.query('SELECT chat_id, is_pinned FROM messages WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    const newStatus = !check.rows[0].is_pinned;
    await pool.query('UPDATE messages SET is_pinned = $1 WHERE id = $2 RETURNING *', [newStatus, id]);
    
    return res.json({ success: true, isPinned: newStatus });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
