import { getPool } from '../../_lib/db.js';
import { protect } from '../../_lib/auth.js';
import { cors } from '../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  const pool = getPool();
  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const { id } = req.query;

  if (req.method === 'PUT') {
    try {
      const { text } = req.body || {};
      const check = await pool.query('SELECT sender_id, chat_id FROM messages WHERE id = $1', [id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (check.rows[0].sender_id !== decoded.uid) return res.status(403).json({ error: 'Unauthorized' });
      
      const msg = await pool.query(
        'UPDATE messages SET text = $1, is_edited = true WHERE id = $2 RETURNING *',
        [text, id]
      );
      
      return res.json({ success: true, isEdited: msg.rows[0].is_edited });
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const check = await pool.query('SELECT sender_id, chat_id, group_id FROM messages WHERE id = $1', [id]);
      if (check.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      if (check.rows[0].sender_id !== decoded.uid) return res.status(403).json({ error: 'Unauthorized' });
      
      const groupId = check.rows[0].group_id;
      if (groupId) {
        await pool.query(
          'UPDATE messages SET text = $1, is_deleted = true, image = NULL WHERE group_id = $2 RETURNING *',
          ['This message was deleted', groupId]
        );
      } else {
        await pool.query(
          'UPDATE messages SET text = $1, is_deleted = true, image = NULL WHERE id = $2 RETURNING *',
          ['This message was deleted', id]
        );
      }
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
