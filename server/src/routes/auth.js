import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OAuth2Client } from 'google-auth-library';
import config from '../config.js';
import { User } from '../models.js';
import { setSession, clearSession, publicUser } from '../auth.js';

const router = Router();
const google = new OAuth2Client(config.googleClientId);

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

// The browser sends the Google ID token ("credential"). We verify it with Google's keys,
// check it was issued for OUR client id, then start our own session cookie.
router.post('/google', limiter, async (req, res) => {
  const credential = req.body?.credential;
  if (typeof credential !== 'string' || credential.length > 4096) {
    return res.status(400).json({ error: 'Missing Google credential.' });
  }

  let payload;
  try {
    const ticket = await google.verifyIdToken({ idToken: credential, audience: config.googleClientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Google sign-in could not be verified. Try again.' });
  }
  if (!payload?.sub) return res.status(401).json({ error: 'Google sign-in could not be verified. Try again.' });

  const email = payload.email_verified === true && payload.email ? payload.email.toLowerCase() : '';
  const role = email && config.adminEmails.includes(email) ? 'admin' : 'user';
  const name = String(payload.name || payload.given_name || 'Member').slice(0, 60);

  const user = await User.findOneAndUpdate(
    { googleId: payload.sub },
    { $set: { name, role } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  setSession(res, user);
  res.json({ user: publicUser(user) });
});

router.get('/me', async (req, res) => {
  if (!req.userId) return res.json({ user: null });
  const user = await User.findById(req.userId);
  res.json({ user: user ? publicUser(user) : null });
});

router.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

export default router;
