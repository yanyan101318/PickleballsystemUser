import { getPool } from '../../_lib/db.js';
import { protect } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const { id } = req.query;
  const pool = getPool();
  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['rejected', id]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
