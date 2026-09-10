import jwt from 'jsonwebtoken';

/**
 * Extracts and verifies the JWT from the Authorization header.
 * Returns decoded payload { uid } or throws an Error.
 */
export function protect(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    const err = new Error('Not authorized, no token');
    err.status = 401;
    throw err;
  }
  const token = auth.split(' ')[1];
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'secret');
  } catch {
    const err = new Error('Not authorized, token failed');
    err.status = 401;
    throw err;
  }
}

export function generateToken(uid) {
  return jwt.sign({ uid }, process.env.JWT_SECRET || 'secret', { expiresIn: '30d' });
}
