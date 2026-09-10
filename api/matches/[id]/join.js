import { getPool } from '../../../_lib/db.js';
import { protect } from '../../../_lib/auth.js';
import { cors } from '../../../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let decoded;
  try { decoded = protect(req); } catch (e) { return res.status(e.status || 401).json({ error: e.message }); }

  const matchId = req.query.id;
  const pool = getPool();
  try {
    const matchRes = await pool.query('SELECT max_players FROM matches WHERE id = $1', [matchId]);
    if (matchRes.rows.length === 0) return res.status(404).json({ error: 'Match not found' });

    const participants = await pool.query('SELECT * FROM match_participants WHERE match_id = $1', [matchId]);
    if (participants.rows.some(p => p.user_id === decoded.uid)) return res.status(400).json({ error: 'Already joined' });
    if (matchRes.rows[0].max_players !== null && participants.rows.length >= matchRes.rows[0].max_players) {
      return res.status(400).json({ error: 'Match is full' });
    }

    await pool.query('INSERT INTO match_participants (match_id, user_id) VALUES ($1, $2)', [matchId, decoded.uid]);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
