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
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2);

    await pool.query(
      `INSERT INTO users (id, email, password_hash, display_name, phone, role) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, email, passwordHash, fullName, phone || '', 'user']
    );

    const token = generateToken(id);
    res.status(201).json({ 
      user: { uid: id, email, fullName, phone: phone || '', role: 'user' }, 
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
      `SELECT id as uid, email, role, password_hash, display_name as full_name, phone 
       FROM users 
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
      `SELECT id as uid, email, role, display_name as full_name, phone 
       FROM users 
       WHERE id = $1`, 
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
      'UPDATE users SET display_name = COALESCE($1, display_name), phone = COALESCE($2, phone) WHERE id = $3',
      [fullName, phone, req.userUid]
    );
    
    const userResult = await pool.query(
      `SELECT id as uid, email, role, display_name as full_name, phone 
       FROM users 
       WHERE id = $1`, 
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

// Forgot Password (SMS OTP)
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const userResult = await pool.query('SELECT id as uid, email, phone FROM users WHERE email = $1', [email]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    if (!user.phone) {
      return res.status(400).json({ error: 'No phone number associated with this account.' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    
    // Create JWT with OTP hash (valid 15 min)
    const token = jwt.sign({ email, otpHash }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });

    // Attempt to send SMS — log only if it fails so the endpoint stays alive
    try {
      const { sendSMS } = await import('../utils/m360.js');
      await sendSMS(user.phone, `Your PickleBros reset code is: ${otp}. It expires in 15 minutes.`);
      console.log(`[forgot-password] OTP sent via SMS to ${user.phone}`);
    } catch (smsErr) {
      console.error('[forgot-password] SMS sending failed (non-fatal):', smsErr.message);
      // Log OTP to console as fallback (remove in production once SMS is confirmed working)
      console.log(`[forgot-password] DEV FALLBACK — OTP for ${email}: ${otp}`);
    }

    res.json({ message: 'OTP sent to your phone', token });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify OTP
router.post('/verify-otp', async (req, res) => {
  const { email, otp, token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.email !== email) {
      return res.status(400).json({ error: 'Invalid token' });
    }
    
    const isMatch = await bcrypt.compare(otp, decoded.otpHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid or incorrect OTP' });
    }
    
    const resetToken = jwt.sign({ email, canReset: true }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
    res.json({ message: 'OTP verified', resetToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(401).json({ error: 'Token expired or invalid' });
  }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
  const { email, newPassword, resetToken } = req.body;
  try {
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret');
    if (decoded.email !== email || !decoded.canReset) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);
    
    await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(401).json({ error: 'Token expired or invalid' });
  }
});

export default router;
