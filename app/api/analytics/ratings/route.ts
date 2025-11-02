export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import mongoose, { type PipelineStage } from 'mongoose';
import Review from '@/models/Review';
import { ensureDemoData } from '@/lib/demoSeed';
import { getOrSet } from '@/lib/cache';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    await ensureDemoData();

    const { searchParams } = new URL(req.url);
    const hoursParam = Number(searchParams.get('hours') ?? '720');
    const limitParam = Number(searchParams.get('limit') ?? '20');
    const sortParam = (searchParams.get('sort') ?? 'count').toLowerCase();
    const menuItemId = searchParams.get('menuItem') ?? searchParams.get('menuItemId');
    const category = searchParams.get('category')?.trim() || undefined;

    const hours = Number.isFinite(hoursParam) && hoursParam > 0 ? hoursParam : 720;
    const limit = Math.min(100, Math.max(1, Number.isFinite(limitParam) ? limitParam : 20));
    const sortKey = sortParam === 'avg' ? 'avg' : 'count';

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const match: Record<string, unknown> = { createdAt: { $gte: since } };
    if (menuItemId) {
      if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
        return NextResponse.json({ error: 'Invalid menuItem id' }, { status: 400 });
      }
      match.menuItem = new mongoose.Types.ObjectId(menuItemId);
    }

    // Explicitly type the $sort object so TS knows values are literal -1
    const sortObject: PipelineStage.Sort['$sort'] =
      sortKey === 'avg'
        ? ({ avg: -1 as const, count: -1 as const })
        : ({ count: -1 as const, avg: -1 as const });

    const cacheKey = [
      'analytics:ratings',
      hours,
      limit,
      sortKey,
      category ?? 'all',
      menuItemId ?? 'any'
    ].join(':');

    const items = await getOrSet(cacheKey, 30_000, async () => {
      const results = await Review.aggregate<{
        menuItem: mongoose.Types.ObjectId | null;
        count: number;
        avg: number;
        name?: string;
        imageUrl?: string;
        category?: string;
      }>([
        { $match: match },
        {
          $group: {
            _id: '$menuItem',
            count: { $sum: 1 },
            avg: { $avg: '$rating' }
          }
        },
        { $sort: sortObject },
        { $limit: limit },
        {
          $lookup: {
            from: 'menuitems',
            localField: '_id',
            foreignField: '_id',
            as: 'mi'
          }
        },
        { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
        ...(category
          ? [
              {
                $match: {
                  'mi.category': category
                }
              } satisfies PipelineStage.Match
            ]
          : []),
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
      ]);

      return results.map((r) => ({
        ...r,
        menuItem: r.menuItem ? String(r.menuItem) : null
      }));
    });

    return NextResponse.json({ since, hours, sort: sortKey, items }, { status: 200 });
  } catch (err) {
    console.error('GET /api/analytics/ratings error', err);
    return NextResponse.json({ error: 'Failed to compute rating analytics' }, { status: 500 });
  }
}
