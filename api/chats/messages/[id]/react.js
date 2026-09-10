import { getPool } from '../../../_lib/db.js';
import { protect } from '../../../_lib/auth.js';
import { cors } from '../../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const { id } = req.query;
  const { emoji } = req.body || {};
  const pool = getPool();
  try {
    const check = await pool.query('SELECT chat_id, reactions FROM messages WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    
    let reactions = check.rows[0].reactions || {};
    
    // Toggle reaction for this user
    if (!reactions[emoji]) reactions[emoji] = [];
    const userIndex = reactions[emoji].indexOf(decoded.uid);
    if (userIndex > -1) {
      reactions[emoji].splice(userIndex, 1);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji].push(decoded.uid);
    }
    
    await pool.query('UPDATE messages SET reactions = $1 WHERE id = $2', [JSON.stringify(reactions), id]);
    return res.json({ success: true, reactions });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
