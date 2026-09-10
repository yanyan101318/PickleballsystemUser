import { getPool } from '../_lib/db.js';
import { protect } from '../_lib/auth.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const pool = getPool();
  try {
    const chat = await pool.query('SELECT unread_by_customer FROM chats WHERE user_id = $1', [decoded.uid]);
    if (chat.rows.length === 0) return res.json({ unread: 0 });
    return res.json({ unread: chat.rows[0].unread_by_customer ? 1 : 0 });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
