import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pool = getPool();
  try {
    const result = await pool.query('SELECT * FROM matches WHERE id = $1', [req.query.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Match not found' });
    const m = result.rows[0];
    return res.json({
      id: m.id.toString(), title: m.title, type: m.type, status: m.status,
      dateTime: m.date_time, courtId: m.court_id,
      maxPlayers: m.max_players, pricePerPlayer: m.price_per_player,
      createdAt: m.created_at,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
