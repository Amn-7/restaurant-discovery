import { Router } from 'express';
import mongoose from 'mongoose';
import { dbConnect } from '../db.js';
import Order from '../shared/models/Order.js';
import MenuItem from '../shared/models/MenuItem.js';
import { createOrderSchema, updateOrderStatusSchema } from '../shared/validators.js';
import { broadcast } from '../shared/sse.js';
import { assertAdmin } from '../session.js';
import { writeLimiter } from '../middleware/ratelimit.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    await dbConnect();
    const { hours = '24', limit = '250', table, status } = req.query as Record<string, string>;
    const since = new Date(Date.now() - Math.max(1, Number(hours)) * 60 * 60 * 1000);
    const lim = Math.min(500, Math.max(1, Number(limit)));
    const query: Record<string, any> = { createdAt: { $gte: since } };
    if (table) {
      const numeric = Number(table);
      query.tableNumber = Number.isNaN(numeric) ? table : { $in: [table, String(numeric), numeric] };
    }
    if (status) query.status = status;
    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(lim).lean();
    res.json(orders.map((o: any) => ({ ...o, _id: String(o._id) })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.post('/', writeLimiter, async (req, res) => {
  try {
    await dbConnect();
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const { tableNumber, status = 'ordered', source = 'staff', notificationPhone, items: itemsInput } = parsed.data as any;

    if (source !== 'table' && !req.session?.admin) return res.status(401).json({ error: 'Unauthorized' });
    if (source === 'table' && status !== 'ordered') return res.status(400).json({ error: 'Guests may only create ordered' });

    const items: Array<{ menuItem: mongoose.Types.ObjectId; name: string; imageUrl?: string; quantity: number }>=[];
    const stockAdjustments = new Map<string, { id: mongoose.Types.ObjectId; quantity: number }>();

    for (const it of itemsInput) {
      let id: mongoose.Types.ObjectId | null = null;
      if (it.menuItem && mongoose.Types.ObjectId.isValid(it.menuItem)) id = new mongoose.Types.ObjectId(it.menuItem);
      let mi: any = null;
      if (id) {
        mi = await MenuItem.findById(id).lean();
      }
      if (!id || !mi) return res.status(400).json({ error: `Menu item not found for ${it.menuItem}` });

      const quantity = it.quantity ?? 1;
      items.push({ menuItem: id, name: mi.name, imageUrl: mi.imageUrl, quantity });

      if (mi.stock !== undefined && mi.stock !== null) {
        const key = String(mi._id);
        const prev = stockAdjustments.get(key);
        stockAdjustments.set(key, { id: mi._id as mongoose.Types.ObjectId, quantity: (prev?.quantity ?? 0) + quantity });
      }
    }

    const payload: any = {
      tableNumber: String(tableNumber),
      status,
      source,
      items,
      createdAt: new Date(),
      ...(notificationPhone ? { notificationPhone } : {}),
      ...(status === 'served' ? { servedAt: new Date() } : {})
    };

    const doc = await Order.create(payload);

    for (const adj of stockAdjustments.values()) {
      await MenuItem.findByIdAndUpdate(
        adj.id,
        [
          { $set: { stock: { $let: { vars: { current: { $ifNull: ['$stock', 0] } }, in: { $max: [{ $subtract: ['$$current', adj.quantity] }, 0] } } } } },
          { $set: { isAvailable: { $cond: [{ $lte: ['$stock', 0] }, false, '$isAvailable'] } } }
        ] as any,
        { new: false }
      );
    }

    try {
      broadcast?.('order-created', {
        _id: String(doc._id),
        tableNumber: doc.tableNumber,
        status: doc.status,
        source: doc.source,
        createdAt: doc.createdAt,
        items: doc.items
      });
    } catch {}

    res.status(201).json({ ...doc.toObject({ depopulate: true }), _id: String(doc._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    await dbConnect();
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const doc = await Order.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ error: 'Order not found' });
    res.json({ ...doc, _id: String(doc._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

router.patch('/:id', assertAdmin, writeLimiter, async (req, res) => {
  try {
    await dbConnect();
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const update: any = { status: parsed.data.status };
    if (parsed.data.status === 'served') update.servedAt = new Date();
    const updated = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    try {
      broadcast?.('order-updated', { _id: String(updated._id), status: updated.status, servedAt: updated.servedAt ?? null });
    } catch {}
    res.json({ ...updated, _id: String(updated._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

router.put('/:id', assertAdmin, writeLimiter, async (req, res) => {
  try {
    await dbConnect();
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const parsed = updateOrderStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    const update: any = { status: parsed.data.status, servedAt: parsed.data.status === 'served' ? new Date() : undefined };
    const updated = await Order.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!updated) return res.status(404).json({ error: 'Order not found' });
    try {
      broadcast?.('order-updated', { _id: String(updated._id), status: updated.status, servedAt: updated.servedAt ?? null });
    } catch {}
    res.json({ ...updated, _id: String(updated._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
});

export default router;
