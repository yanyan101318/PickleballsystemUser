import bcrypt from 'bcryptjs';
import { getPool } from '../_lib/db.js';
import { generateToken } from '../_lib/auth.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password, fullName, phone } = req.body || {};
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }

  const pool = getPool();
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, display_name, phone, role)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email.trim(), passwordHash, fullName.trim(), phone?.trim() || '', 'user']
    );

    const token = generateToken(id);
    return res.status(201).json({
      user: { uid: id, email, fullName, phone: phone || '', role: 'user' },
      token,
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
