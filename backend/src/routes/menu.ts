import { Router } from 'express';
import { dbConnect } from '../db.js';
import MenuItem from '../shared/models/MenuItem.js';
import { createMenuItemSchema, updateMenuItemSchema } from '../shared/validators.js';
import { assertAdmin } from '../session.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await dbConnect();
    const items = await MenuItem.find({}).sort({ createdAt: -1 }).lean();
    res.json(items.map((it: any) => ({ ...it, _id: String(it._id) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load menu', message: err instanceof Error ? err.message : 'unknown' });
  }
});

router.post('/', assertAdmin, async (req, res) => {
  try {
    await dbConnect();
    const parsed = createMenuItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

    const payload = { ...parsed.data } as any;
    if (payload.stock !== undefined) {
      if (payload.stock === null) payload.stock = null; else {
        payload.stock = Math.max(0, Math.trunc(payload.stock));
        if (payload.stock === 0) payload.isAvailable = false;
      }
    }
    if (payload.lowStockThreshold !== undefined) {
      if (payload.lowStockThreshold === null) payload.lowStockThreshold = null; else {
        payload.lowStockThreshold = Math.max(0, Math.trunc(payload.lowStockThreshold));
        if (payload.stock !== undefined && payload.stock !== null && payload.lowStockThreshold > payload.stock) {
          payload.lowStockThreshold = payload.stock;
        }
      }
    }

    const doc = await MenuItem.create(payload);
    const o = doc.toObject({ depopulate: true });
    res.status(201).json({ ...o, _id: String(o._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item', message: err instanceof Error ? err.message : 'unknown' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await dbConnect();
    const doc = await MenuItem.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ...doc, _id: String(doc._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

router.put('/:id', assertAdmin, async (req, res) => {
  try {
    await dbConnect();
    const parsed = updateMenuItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

    const updateData = { ...parsed.data } as any;
    if (updateData.stock !== undefined) {
      if (updateData.stock === null) updateData.stock = null; else {
        updateData.stock = Math.max(0, Math.trunc(updateData.stock));
        if (updateData.stock === 0) updateData.isAvailable = false; else if (updateData.isAvailable === undefined) updateData.isAvailable = true;
      }
    }
    if (updateData.lowStockThreshold !== undefined) {
      if (updateData.lowStockThreshold === null) updateData.lowStockThreshold = null; else {
        updateData.lowStockThreshold = Math.max(0, Math.trunc(updateData.lowStockThreshold));
        if (updateData.stock !== undefined && updateData.stock !== null && updateData.lowStockThreshold > updateData.stock) {
          updateData.lowStockThreshold = updateData.stock;
        }
      }
    }
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json({ ...updated, _id: String(updated._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update' });
  }
});

router.delete('/:id', assertAdmin, async (req, res) => {
  try {
    await dbConnect();
    const deleted = await MenuItem.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
