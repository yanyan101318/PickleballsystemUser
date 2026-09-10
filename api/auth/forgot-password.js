import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool } from '../_lib/db.js';
import { sendSMS } from '../_lib/m360.js';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const pool = getPool();
  try {
    const result = await pool.query(
      'SELECT id as uid, email, phone FROM users WHERE email = $1',
      [email]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    if (!user.phone) return res.status(400).json({ error: 'No phone number associated with this account.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const token = jwt.sign({ email, otpHash }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });

    try {
      await sendSMS(user.phone, `Your PickleBros reset code is: ${otp}. It expires in 15 minutes.`);
      console.log(`[forgot-password] OTP sent via SMS to ${user.phone}`);
    } catch (smsErr) {
      console.error('[forgot-password] SMS failed (non-fatal):', smsErr.message);
      console.log(`[forgot-password] DEV FALLBACK — OTP for ${email}: ${otp}`);
    }

    return res.json({ message: 'OTP sent to your phone', token });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
