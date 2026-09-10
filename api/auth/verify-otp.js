import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cors } from '../_lib/cors.js';

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp, token } = req.body || {};
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    if (decoded.email !== email) return res.status(400).json({ error: 'Invalid token' });

    const isMatch = await bcrypt.compare(otp, decoded.otpHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid or incorrect OTP' });

    const resetToken = jwt.sign({ email, canReset: true }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
    return res.json({ message: 'OTP verified', resetToken });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}
