import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

const mapMatch = (m) => ({
  id: m.id.toString(), title: m.title, type: m.type, status: m.status,
  dateTime: m.date_time, courtId: m.court_id,
  maxPlayers: m.max_players, pricePerPlayer: m.price_per_player,
  createdAt: m.created_at,
});

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pool = getPool();
  try {
    const result = await pool.query(
      "SELECT * FROM matches WHERE type = 'open_play' AND status = 'upcoming' AND date_time > NOW() ORDER BY date_time ASC"
    );
    return res.json(result.rows.map(mapMatch));
  } catch (error) {
    console.error('Error fetching open plays:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
