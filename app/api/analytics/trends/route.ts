export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import type { Db } from 'mongodb';
import { dbConnect } from '@/lib/db';
import { ensureDemoData } from '@/lib/demoSeed';
import { getOrSet } from '@/lib/cache';
import {
  type PopularItem,
  deriveTrends,
  makePopularKey
} from '@/lib/popular';

type TrendEntry = {
  item: PopularItem;
  change: {
    diff: number;
    pct: number | null;
    direction: 'up' | 'down' | 'flat' | 'new';
    previous: number;
  };
};

type TrendWindow = {
  hours: number;
  since: string;
  until: string;
  rising: TrendEntry[];
  falling: TrendEntry[];
  steady: TrendEntry[];
};

const DEFAULT_WINDOWS = [6, 24];
const DEFAULT_LIMIT = 5;
const CACHE_TTL_MS = 30_000;

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    await ensureDemoData();

    const { searchParams } = new URL(req.url);
    const rawWindows = searchParams.get('windows');
    const category = searchParams.get('category')?.trim() || undefined;
    const tableParam = searchParams.get('table')?.trim() || undefined;
    const limit = Math.min(
      10,
      Math.max(1, Number(searchParams.get('limit') ?? DEFAULT_LIMIT))
    );

    const windows = rawWindows
      ? rawWindows
          .split(',')
          .map((w) => Number(w.trim()))
          .filter((w) => Number.isFinite(w) && w > 0)
      : DEFAULT_WINDOWS;

    const dedupedWindows = Array.from(new Set(windows)).sort((a, b) => a - b);

    const db: Db | undefined = mongoose.connection.db as unknown as Db | undefined;
    if (!db) {
      throw new Error('MongoDB connection not ready (connection.db is undefined).');
    }

    const tableNumber = tableParam ? tableParam : undefined;

    const cacheKey = [
      'analytics:trends',
      dedupedWindows.join(','),
      limit,
      category ?? 'all',
      tableNumber ?? 'all'
    ].join(':');

    const payload = await getOrSet(cacheKey, CACHE_TTL_MS, async () => {
      const results: TrendWindow[] = [];
      for (const hours of dedupedWindows) {
        const summary = await computeWindow({
          db,
          hours,
          limit,
          category,
          tableNumber
        });
        results.push(summary);
      }
      return { windows: results };
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error('GET /api/analytics/trends error', err);
    return NextResponse.json({ error: 'Failed to compute trends' }, { status: 500 });
  }
}

async function computeWindow(params: {
  db: Db;
  hours: number;
  limit: number;
  category?: string;
  tableNumber?: string;
}): Promise<TrendWindow> {
  const { db, hours, limit, category, tableNumber } = params;
  const now = new Date();
  const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
  const previousWindowStart = new Date(since.getTime() - hours * 60 * 60 * 1000);

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

  const pipeline = (start: Date, end?: Date): Record<string, unknown>[] => {
    const stages: Record<string, unknown>[] = [
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
      stages.push({ $match: { 'mi.category': category } });
    }

    stages.push(
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
      { $limit: limit * 3 }
    );

    return stages;
  };

  const currentItems = await db
    .collection('orders')
    .aggregate<PopularItem>(pipeline(since))
    .toArray();

  const previousItems = await db
    .collection('orders')
    .aggregate<PopularItem>(pipeline(previousWindowStart, since))
    .toArray();

  const { rising, falling, stable } = deriveTrends(currentItems, previousItems, limit);

  const mapEntry = (entry: ReturnType<typeof deriveTrends>['rising'][number]): TrendEntry => ({
    item: entry.current,
    change: {
      diff: entry.diff,
      pct: entry.pct,
      direction: entry.direction,
      previous: entry.previous?.count ?? 0
    }
  });

  const pruneDuplicates = (entries: TrendEntry[]) => {
    const seen = new Set<string>();
    const list: TrendEntry[] = [];
    for (const entry of entries) {
      const key = makePopularKey(entry.item);
      if (!seen.has(key)) {
        seen.add(key);
        list.push(entry);
      }
      if (list.length >= limit) break;
    }
    return list;
  };

  return {
    hours,
    since: since.toISOString(),
    until: now.toISOString(),
    rising: pruneDuplicates(rising.map(mapEntry)),
    falling: pruneDuplicates(falling.map(mapEntry)),
    steady: pruneDuplicates(stable.map(mapEntry))
  };
}
