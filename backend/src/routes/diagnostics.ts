import { Router } from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { assertAdmin } from '../session.js';

const router = Router();

async function authorizeWithHeader(req: any): Promise<boolean> {
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  const adminHash = process.env.ADMIN_KEY_HASH;
  const adminPlain = process.env.ADMIN_KEY;
  if (!adminKey) return false;
  if (adminHash) {
    try {
      if (await bcrypt.compare(adminKey, adminHash)) return true;
    } catch {}
  }
  if (adminPlain && adminKey === adminPlain) return true;
  return false;
}

router.get('/diagnostics', async (req, res, next) => {
  // Allow either session admin or x-admin-key header
  // First try session
  let authorized = false;
  try {
    // Reuse assertAdmin; if it returns next, then session is valid
    // We can't call it directly here; instead check req.session
    // (iron-session populates req.session)
    if (req.session?.admin) authorized = true;
  } catch {}
  if (!authorized) {
    authorized = await authorizeWithHeader(req);
  }
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const conn = mongoose.connection;
    const stateMap: Record<number, string> = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    const db = conn.db;
    const counts: Record<string, number | null> = { menuitems: null, orders: null, reviews: null };
    if (db) {
      counts.menuitems = await db.collection('menuitems').estimatedDocumentCount().catch(() => null);
      counts.orders = await db.collection('orders').estimatedDocumentCount().catch(() => null);
      counts.reviews = await db.collection('reviews').estimatedDocumentCount().catch(() => null);
    }
    res.json({
      ok: true,
      connection: {
        state: stateMap[conn.readyState] ?? String(conn.readyState),
        dbName: db?.databaseName ?? null
      },
      counts,
      versions: {
        node: process.versions.node,
        mongoose: mongoose.version
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: 'diagnostics_failed', message: err instanceof Error ? err.message : 'unknown' });
  }
});

export default router;

