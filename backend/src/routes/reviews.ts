import { Router } from 'express';
import mongoose from 'mongoose';
import { dbConnect } from '../db.js';
import Review from '../shared/models/Review.js';
import MenuItem from '../shared/models/MenuItem.js';
import { createReviewSchema } from '../shared/validators.js';
import { writeLimiter } from '../middleware/ratelimit.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    await dbConnect();
    const { menuItem, menuItemId, hours = '720', limit = '20' } = req.query as Record<string, string>;
    const since = new Date(Date.now() - Math.max(1, Number(hours)) * 60 * 60 * 1000);
    const lim = Math.min(100, Math.max(1, Number(limit)));
    const q: any = { createdAt: { $gte: since } };
    const id = menuItem || menuItemId;
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'Invalid menuItem id' });
      q.menuItem = new mongoose.Types.ObjectId(id);
    }
    const docs = await Review.find(q).sort({ createdAt: -1 }).limit(lim).lean();
    res.json(docs.map((d: any) => ({ ...d, _id: String(d._id), menuItem: d.menuItem ? String(d.menuItem) : null, order: d.order ? String(d.order) : null })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.post('/', writeLimiter, async (req, res) => {
  try {
    await dbConnect();
    const parsed = createReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const { menuItemId, rating, comment, orderId } = parsed.data as any;
    if (!mongoose.Types.ObjectId.isValid(menuItemId)) return res.status(400).json({ error: 'Invalid menuItemId' });
    if (orderId && !mongoose.Types.ObjectId.isValid(orderId)) return res.status(400).json({ error: 'Invalid orderId' });
    const menuItemObjectId = new mongoose.Types.ObjectId(menuItemId);
    const exists = await MenuItem.exists({ _id: menuItemObjectId });
    if (!exists) return res.status(404).json({ error: 'menu item not found' });
    const created = await Review.create({ menuItem: menuItemObjectId, order: orderId ? new mongoose.Types.ObjectId(orderId) : undefined, rating, comment });
    const o: any = created.toObject({ depopulate: true });
    res.status(201).json({ ...o, _id: String(o._id), menuItem: o.menuItem ? String(o.menuItem) : null, order: o.order ? String(o.order) : null });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

export default router;
