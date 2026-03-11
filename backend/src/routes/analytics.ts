import { Router } from 'express';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { dbConnect } from '../db.js';
import { withCache } from '../lib/responseCache.js';

const router = Router();

router.get('/popular', async (req, res) => {
  try {
    const cacheKey = `analytics:popular:${req.originalUrl}`;
    const cached = await withCache(cacheKey, 10_000, async () => {
      await dbConnect();
      const { hours = '24', limit = '8', category, table, compare } = req.query as Record<string, string>;
      const since = new Date(Date.now() - Math.max(1, Number(hours)) * 60 * 60 * 1000);
      const lim = Math.min(50, Math.max(1, Number(limit)));
      const includePrevious = compare === '1' || compare === 'true';
      const db: Db | undefined = mongoose.connection.db as unknown as Db | undefined;
      if (!db) throw new Error('MongoDB connection not ready');

      const normalizeTable = (v?: string) => (v ? v.trim() : undefined);
      const tableNumber = normalizeTable(table);

      const buildMatch = (start: Date, end?: Date) => {
        const timeCond: any = { $gte: start };
        if (end) timeCond.$lt = end;
        const match: any = { $or: [{ createdAt: timeCond }, { servedAt: timeCond }] };
        if (tableNumber) match.tableNumber = tableNumber;
        return match;
      };

      const buildPipeline = (start: Date, end?: Date) => {
        const pipeline: any[] = [
          { $match: buildMatch(start, end) },
          { $unwind: '$items' },
          { $addFields: { itemRef: { $ifNull: ['$items.menuItem', '$items.itemId'] } } },
          { $match: { itemRef: { $ne: null } } },
          { $group: { _id: '$itemRef', count: { $sum: { $ifNull: ['$items.quantity', 1] } } } },
          { $sort: { count: -1 } },
          { $lookup: { from: 'menuitems', localField: '_id', foreignField: '_id', as: 'mi' } },
          { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } }
        ];
        if (category) pipeline.push({ $match: { 'mi.category': category } });
        pipeline.push(
          {
            $project: {
              _id: 0,
              menuItem: { $cond: [{ $ifNull: ['$mi._id', false] }, { $toString: '$_id' }, null] },
              name: '$mi.name',
              imageUrl: '$mi.imageUrl',
              category: '$mi.category',
              count: 1
            }
          },
          { $limit: lim }
        );
        return pipeline;
      };

      const currentPipeline = buildPipeline(since);
      const currentItems = await db.collection('orders').aggregate(currentPipeline).toArray();
      const payload: any = { since: since.toISOString(), hours: Number(hours), items: currentItems };
      if (includePrevious) {
        const previousWindowStart = new Date(since.getTime() - Number(hours) * 60 * 60 * 1000);
        const previousItems = await db
          .collection('orders')
          .aggregate(buildPipeline(previousWindowStart, since))
          .toArray();
        payload.previous = {
          since: previousWindowStart.toISOString(),
          until: since.toISOString(),
          items: previousItems
        };
      }
      return payload;
    });
    res.setHeader('X-Cache', cached.hit ? 'HIT' : 'MISS');
    res.json(cached.value);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute popular' });
  }
});

router.get('/ratings', async (req, res) => {
  try {
    const cacheKey = `analytics:ratings:${req.originalUrl}`;
    const cached = await withCache(cacheKey, 10_000, async () => {
      await dbConnect();
      const { hours = '720', limit = '20', sort = 'count', category, menuItem, menuItemId } =
        req.query as Record<string, string>;
      const since = new Date(Date.now() - Math.max(1, Number(hours)) * 60 * 60 * 1000);
      const lim = Math.min(100, Math.max(1, Number(limit)));
      const sortKey = sort === 'avg' ? 'avg' : 'count';

      const match: any = { createdAt: { $gte: since } };
      const id = menuItem || menuItemId;
      if (id) {
        if (!mongoose.Types.ObjectId.isValid(id)) throw { statusCode: 400, message: 'Invalid menuItem id' };
        match.menuItem = new mongoose.Types.ObjectId(id);
      }

      const sortObject = sortKey === 'avg' ? { avg: -1, count: -1 } : { count: -1, avg: -1 };
      const results = await mongoose.connection.db!
        .collection('reviews')
        .aggregate([
          { $match: match },
          { $group: { _id: '$menuItem', count: { $sum: 1 }, avg: { $avg: '$rating' } } },
          { $sort: sortObject },
          { $limit: lim },
          { $lookup: { from: 'menuitems', localField: '_id', foreignField: '_id', as: 'mi' } },
          { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
          ...(category ? ([{ $match: { 'mi.category': category } }] as any) : []),
          {
            $project: {
              _id: 0,
              menuItem: '$_id',
              count: 1,
              avg: { $round: ['$avg', 2] },
              name: '$mi.name',
              imageUrl: '$mi.imageUrl',
              category: '$mi.category'
            }
          }
        ])
        .toArray();

      return {
        status: 200,
        payload: {
          since,
          hours: Number(hours),
          sort: sortKey,
          items: results.map((r: any) => ({ ...r, menuItem: r.menuItem ? String(r.menuItem) : null }))
        }
      };
    });

    res.setHeader('X-Cache', cached.hit ? 'HIT' : 'MISS');
    res.json((cached.value as any).payload);
  } catch (err: any) {
    if (err?.statusCode === 400) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Failed to compute rating analytics' });
  }
});

export default router;
