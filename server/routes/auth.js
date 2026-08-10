import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = express.Router();

const generateToken = (uid) => {
  return jwt.sign({ uid }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
};

// Register
router.post('/register', async (req, res) => {
  const { email, password, fullName, phone } = req.body;
  try {
    const userExists = await pool.query('SELECT * FROM admin WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const uid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2);

    await pool.query(
      `INSERT INTO admin (uid, email, password_hash, full_name, phone, role) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uid, email, passwordHash, fullName, phone || '', 'admin']
    );

    const token = generateToken(uid);
    res.status(201).json({ 
      user: { uid, email, fullName, phone: phone || '', role: 'admin' }, 
      token 
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query(
      `SELECT uid, email, role, password_hash, full_name, phone 
       FROM admin 
       WHERE email = $1`, 
      [email]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }
    const userRow = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, userRow.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(userRow.uid);
    const user = {
      uid: userRow.uid,
      email: userRow.email,
      fullName: userRow.full_name,
      phone: userRow.phone,
      role: userRow.role
    };
    res.json({ user, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to protect routes
export const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ error: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userUid = decoded.uid;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

// Get current user profile
router.get('/me', protect, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT uid, email, role, full_name, phone 
       FROM admin 
       WHERE uid = $1`, 
      [req.userUid]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const row = userResult.rows[0];
    res.json({
      uid: row.uid,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      role: row.role
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', protect, async (req, res) => {
  const { fullName, phone } = req.body;
  try {
    await pool.query(
      'UPDATE admin SET full_name = COALESCE($1, full_name), phone = COALESCE($2, phone) WHERE uid = $3',
      [fullName, phone, req.userUid]
    );
    
    const userResult = await pool.query(
      `SELECT uid, email, role, full_name, phone 
       FROM admin 
       WHERE uid = $1`, 
      [req.userUid]
    );
    const row = userResult.rows[0];
    res.json({
      uid: row.uid,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      role: row.role
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
