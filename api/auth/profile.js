import { getPool } from '../_lib/db.js';
import { protect } from '../_lib/auth.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const { fullName, phone } = req.body || {};
  const pool = getPool();
  try {
    await pool.query(
      'UPDATE users SET display_name = COALESCE($1, display_name), phone = COALESCE($2, phone) WHERE id = $3',
      [fullName, phone, decoded.uid]
    );
    const result = await pool.query(
      `SELECT id as uid, email, role, display_name as full_name, phone FROM users WHERE id = $1`,
      [decoded.uid]
    );
    const row = result.rows[0];
    return res.json({ uid: row.uid, email: row.email, fullName: row.full_name, phone: row.phone, role: row.role });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
