import jwt from 'jsonwebtoken';
import config from './config.js';
import { User } from './models.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  path: '/',
};

export function setSession(res, user) {
  const token = jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, { ...cookieOptions, maxAge: WEEK_MS });
}

export function clearSession(res) {
  res.clearCookie('token', cookieOptions);
}

export function publicUser(user) {
  return { id: user.id, name: user.name, role: user.role };
}

// Reads the cookie on every request. Sets req.userId when the token is valid.
export function loadUser(req, _res, next) {
  const token = req.cookies?.token;
  if (token) {
    try {
      req.userId = jwt.verify(token, config.jwtSecret).sub;
    } catch {
      // expired or tampered token: treat as signed out
    }
  }
  next();
}

export async function requireUser(req, res, next) {
  if (!req.userId) return res.status(401).json({ error: 'Sign in with Google to do that.' });
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Your session is no longer valid. Sign in again.' });
  req.user = user;
  next();
}
