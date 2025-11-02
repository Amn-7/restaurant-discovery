export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { ensureDemoData } from '@/lib/demoSeed';
import type { PopularItem, PopularResponse, PopularWindow } from '@/lib/popular';
import { getOrSet } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    await ensureDemoData();

    const { searchParams } = new URL(req.url);
    const hours = Math.max(1, Number(searchParams.get('hours') ?? '24'));
    const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '8')));
    const category = searchParams.get('category')?.trim() || undefined;
    const tableParam = searchParams.get('table')?.trim() || undefined;
    const compare = searchParams.get('compare');
    const includePrevious = compare === '1' || compare === 'true';
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // ✅ TS-safe access to the native Mongo driver Db
    const db: Db | undefined = mongoose.connection.db as unknown as Db | undefined;
    if (!db) {
      throw new Error('MongoDB connection not ready (connection.db is undefined).');
    }

    const normalizeTable = (value: string | undefined): string | undefined => {
      if (!value) return undefined;
      return value;
    };

    const tableNumber = normalizeTable(tableParam);

    const buildMatch = (start: Date, end?: Date) => {
      const timeCondition: Record<string, unknown> = { $gte: start };
      if (end) {
        timeCondition.$lt = end;
      }

      const match: Record<string, unknown> = {
        $or: [
          { createdAt: timeCondition },
          { servedAt: timeCondition }
        ]
      };

      if (tableNumber) {
        match.tableNumber = tableNumber;
      }

      return match;
    };

    const buildPipeline = (start: Date, end?: Date): Record<string, unknown>[] => {
      const pipeline: Record<string, unknown>[] = [
        { $match: buildMatch(start, end) },
        { $unwind: '$items' },
        { $addFields: { itemRef: { $ifNull: ['$items.menuItem', '$items.itemId'] } } },
        { $match: { itemRef: { $ne: null } } },
        {
          $group: {
            _id: '$itemRef',
            count: { $sum: { $ifNull: ['$items.quantity', 1] } }
          }
        },
        { $sort: { count: -1 } },
        {
          $lookup: {
            from: 'menuitems',
            localField: '_id',
            foreignField: '_id',
            as: 'mi'
          }
        },
        { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } }
      ];

      if (category) {
        pipeline.push({ $match: { 'mi.category': category } });
      }

      pipeline.push(
        { $project: {
            _id: 0,
            menuItem: { $cond: [{ $ifNull: ['$mi._id', false] }, { $toString: '$_id' }, null] },
            name: '$mi.name',
            imageUrl: '$mi.imageUrl',
            category: '$mi.category',
            count: 1
          }
        },
        { $limit: limit }
      );

      return pipeline;
    };

    const cacheKey = [
      'analytics:popular',
      hours,
      limit,
      category ?? 'any',
      tableNumber ?? 'all',
      includePrevious ? 'compare' : 'single'
    ].join(':');

    const response = await getOrSet(cacheKey, 30_000, async () => {
      const currentPipeline = buildPipeline(since);
      const currentItems = await db
        .collection('orders')
        .aggregate<PopularItem>(currentPipeline)
        .toArray();

      const payload: PopularResponse = {
        since: since.toISOString(),
        hours,
        items: currentItems
      };

      if (includePrevious) {
        const previousWindowStart = new Date(since.getTime() - hours * 60 * 60 * 1000);
        const previousPipeline = buildPipeline(previousWindowStart, since);
        const previousItems = await db
          .collection('orders')
          .aggregate<PopularItem>(previousPipeline)
          .toArray();

        const previousWindow: PopularWindow = {
          since: previousWindowStart.toISOString(),
          until: since.toISOString(),
          items: previousItems
        };
        payload.previous = previousWindow;
      }

      return payload;
    });

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error('GET /api/analytics/popular error', err);
    return NextResponse.json({ error: 'Failed to compute popular' }, { status: 500 });
  }
}
