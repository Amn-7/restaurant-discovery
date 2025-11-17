import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';

const router = Router();

router.get('/login', (req, res) => {
  res.json({ authenticated: !!req.session?.admin });
});

router.post('/login', async (req: Request, res: Response) => {
  const adminHash = process.env.ADMIN_KEY_HASH;
  const adminKey = process.env.ADMIN_KEY;
  if (!adminHash && !adminKey) return res.status(501).json({ error: 'Admin login not configured' });
  const { key = '', rememberMe = false } = req.body ?? {};

  let valid = false;
  if (adminHash) {
    try { valid = await bcrypt.compare(String(key), adminHash); } catch { valid = false; }
  }
  if (!valid && adminKey) {
    valid = String(key) === adminKey;
  }
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.admin = { id: 'admin' };
  if (rememberMe) {
    // @ts-ignore
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
  }
  await req.session.save();
  res.json({ ok: true });
});

router.post('/logout', async (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

export default router;

