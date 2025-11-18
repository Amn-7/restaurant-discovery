import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { loginLimiter } from '../middleware/ratelimit.js';

const router = Router();

router.get('/login', (req, res) => {
  res.json({ authenticated: !!req.session?.admin });
});

router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const adminHash = process.env.ADMIN_KEY_HASH;
  const adminKey = process.env.ADMIN_KEY;
  // In production, require a hash; ignore plain ADMIN_KEY
  if (process.env.NODE_ENV === 'production') {
    if (!adminHash) return res.status(501).json({ error: 'Admin login not configured (hash required in production)' });
  } else {
    if (!adminHash && !adminKey) return res.status(501).json({ error: 'Admin login not configured' });
  }
  const { key = '', rememberMe = false } = req.body ?? {};

  let valid = false;
  if (adminHash) {
    try { valid = await bcrypt.compare(String(key), adminHash); } catch { valid = false; }
  }
  if (!valid && adminKey && process.env.NODE_ENV !== 'production') {
    valid = String(key) === adminKey;
  }
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.admin = { id: 'admin' };
  if (rememberMe) {
    // iron-session (express) exposes cookie settings on sessionOptions
    try {
      // @ts-expect-error runtime property provided by iron-session
      if (req.sessionOptions && req.sessionOptions.cookieOptions) {
        // @ts-expect-error runtime property provided by iron-session
        req.sessionOptions.cookieOptions.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
    } catch {}
  }
  await req.session.save();
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

export default router;
