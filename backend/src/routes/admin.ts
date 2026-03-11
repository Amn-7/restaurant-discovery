import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { loginLimiter } from '../middleware/ratelimit.js';
import { rememberMeSessionMiddleware } from '../session.js';

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

  // If rememberMe, re-initialize session with 30-day TTL cookie
  if (rememberMe) {
    await new Promise<void>((resolve, reject) => {
      rememberMeSessionMiddleware(req, res, (err?: any) => (err ? reject(err) : resolve()));
    });
  }

  req.session.admin = { id: 'admin' };
  await req.session.save();
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

export default router;
