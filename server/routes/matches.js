import express from 'express';
import pool from '../db.js';
import { protect } from './auth.js';

const router = express.Router();

// Get upcoming open plays
router.get('/open-plays', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM matches WHERE type = 'open_play' AND status = 'upcoming' AND date_time > NOW() ORDER BY date_time ASC"
    );
    const matches = result.rows.map(m => ({
      id: m.id.toString(),
      title: m.title,
      type: m.type,
      status: m.status,
      dateTime: m.date_time,
      courtId: m.court_id,
      maxPlayers: m.max_players,
      pricePerPlayer: m.price_per_player,
      createdAt: m.created_at
    }));
    res.json(matches);
  } catch (error) {
    console.error('Error fetching open plays:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single match
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM matches WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Match not found' });
    }
    const m = result.rows[0];
    res.json({
      id: m.id.toString(),
      title: m.title,
      type: m.type,
      status: m.status,
      dateTime: m.date_time,
      courtId: m.court_id,
      maxPlayers: m.max_players,
      pricePerPlayer: m.price_per_player,
      createdAt: m.created_at
    });
  } catch (error) {
    console.error('Error fetching match:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Join a match
router.post('/:id/join', protect, async (req, res) => {
  try {
    const matchId = req.params.id;
    // Check if full or already joined
    const matchRes = await pool.query('SELECT max_players FROM matches WHERE id = $1', [matchId]);
    if (matchRes.rows.length === 0) return res.status(404).json({ error: 'Match not found' });
    
    const participantsRes = await pool.query('SELECT * FROM match_participants WHERE match_id = $1', [matchId]);
    
    if (participantsRes.rows.some(p => p.user_id === req.userUid)) {
      return res.status(400).json({ error: 'Already joined' });
    }
    if (matchRes.rows[0].max_players !== null && participantsRes.rows.length >= matchRes.rows[0].max_players) {
      return res.status(400).json({ error: 'Match is full' });
    }

    await pool.query('INSERT INTO match_participants (match_id, user_id) VALUES ($1, $2)', [matchId, req.userUid]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error joining match:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
