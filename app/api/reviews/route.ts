export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import { Types } from 'mongoose';
import Review, { type ReviewDoc } from '@/models/Review';
import MenuItem from '@/models/MenuItem';
import { ensureDemoData } from '@/lib/demoSeed';
import { createReviewSchema } from '@/lib/validators';
import { writeLimiter } from '@/lib/ratelimit';
import { clearCache } from '@/lib/cache';
import { getRequestIp } from '@/lib/request';
import { logError, logInfo, logWarn } from '@/lib/logger';

/**
 * GET /api/reviews?menuItem=<id>&hours=720&limit=20
 * - List recent reviews (optionally filter by menu item)
 */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    await ensureDemoData();

    const { searchParams } = new URL(req.url);
    const menuItemParam = searchParams.get('menuItem') ?? searchParams.get('menuItemId');
    const hours = Number(searchParams.get('hours') ?? 720); // default 30 days
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)));

    const since = new Date(Date.now() - Math.max(1, hours) * 60 * 60 * 1000);

    const query: Record<string, unknown> = { createdAt: { $gte: since } };
    if (menuItemParam) {
      if (!Types.ObjectId.isValid(menuItemParam)) {
        return NextResponse.json({ error: 'Invalid menuItem id' }, { status: 400 });
      }
      query.menuItem = new Types.ObjectId(menuItemParam);
    }

    const docs = await Review.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<
        (ReviewDoc & {
          _id: Types.ObjectId;
          menuItem?: Types.ObjectId | null;
          order?: Types.ObjectId | null;
        })[]
      >();

    const normalized = docs.map((doc) => ({
      ...doc,
      _id: doc._id.toString(),
      menuItem: doc.menuItem ? doc.menuItem.toString() : null,
      order: doc.order ? doc.order.toString() : null,
    }));

    return NextResponse.json(normalized, { status: 200 });
  } catch (err) {
    logError('reviews.fetch_failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

/**
 * POST /api/reviews
 * {
 *   "menuItemId": "<ObjectId>",      // required
 *   "rating": 1..5,                  // required
 *   "comment": "optional text",      // optional
 *   "orderId": "<ObjectId>"          // optional
 * }
 */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const ip = getRequestIp(req);
    const rate = await writeLimiter.limit(`reviews:create:${ip}`);
    if (!rate.success) {
      logWarn('reviews.rate_limited', { ip });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { menuItemId, rating, comment, orderId } = parsed.data;

    if (!Types.ObjectId.isValid(menuItemId)) {
      return NextResponse.json({ error: 'Invalid menuItemId' }, { status: 400 });
    }
    if (orderId && !Types.ObjectId.isValid(orderId)) {
      return NextResponse.json({ error: 'Invalid orderId' }, { status: 400 });
    }

    const menuItemObjectId = new Types.ObjectId(menuItemId);
    const exists = await MenuItem.exists({ _id: menuItemObjectId });
    if (!exists) {
      return NextResponse.json({ error: 'menu item not found' }, { status: 404 });
    }

    const orderObjectId = orderId ? new Types.ObjectId(orderId) : undefined;

    const created = await Review.create({
      menuItem: menuItemObjectId,
      order: orderObjectId,
      rating,
      comment,
    });

    const createdObj = created.toObject({
      depopulate: true
    }) as ReviewDoc & {
      _id: Types.ObjectId;
      menuItem?: Types.ObjectId | null;
      order?: Types.ObjectId | null;
    };

    const responseBody = {
      ...createdObj,
      _id: createdObj._id.toString(),
      menuItem: createdObj.menuItem ? createdObj.menuItem.toString() : null,
      order: createdObj.order ? createdObj.order.toString() : null
    };

    clearCache('analytics');

    logInfo('reviews.created', {
      reviewId: responseBody._id,
      menuItem: responseBody.menuItem,
      rating: responseBody.rating
    });

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    logError('reviews.create_failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}
