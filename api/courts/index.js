import { getPool } from '../_lib/db.js';
import { cors } from '../_lib/cors.js';

const mapCourt = (c) => ({
  id: c.id, name: c.name, description: c.description,
  pricePerHour: c.price_per_hour, amenities: c.amenities,
  isActive: c.is_active, type: c.type, location: c.location,
  rating: c.rating, reviews: c.reviews, maxPlayers: c.max_players,
  isOpenPlay: c.is_open_play, openPlaySchedule: c.open_play_schedule,
  courtNumber: c.court_number,
  activeStartTime: c.active_start_time, activeEndTime: c.active_end_time,
  createdAt: c.created_at,
});

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const pool = getPool();
  try {
    const result = await pool.query('SELECT * FROM courts ORDER BY id ASC');
    return res.json(result.rows.map(mapCourt));
  } catch (error) {
    console.error('Error fetching courts:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
