// app/api/orders/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';
import Order from '@/models/Order';
import MenuItem, { type MenuItemDoc } from '@/models/MenuItem';
import { broadcast } from '@/lib/sse';
import { assertAdmin } from '@/lib/auth';
import { writeLimiter } from '@/lib/ratelimit';
import { clearCache } from '@/lib/cache';
import { createOrderSchema } from '@/lib/validators';
import { getRequestIp } from '@/lib/request';
import { logError, logInfo, logWarn } from '@/lib/logger';

type OrderStatus = 'ordered' | 'preparing' | 'served';
type OrderSource = 'staff' | 'table' | 'kiosk' | 'other';

const toObjectId = (v: unknown) =>
  typeof v === 'string' && mongoose.Types.ObjectId.isValid(v)
    ? new mongoose.Types.ObjectId(v)
    : null;

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'OPTIONS,POST' }
  });
}

/** CREATE ORDER */
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const ip = getRequestIp(req);
    const rate = await writeLimiter.limit(`orders:create:${ip}`);
    if (!rate.success) {
      logWarn('orders.rate_limit_exceeded', { ip });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const { tableNumber, status = 'ordered', source = 'staff', notificationPhone, items: itemsInput } = parsed.data;
    const normalizedTableNumber = String(tableNumber).trim();
    if (!normalizedTableNumber) {
      return NextResponse.json({ error: 'Table number is required' }, { status: 400 });
    }
    const statusValue = status as OrderStatus;
    const sourceValue = source as OrderSource;

    if (sourceValue !== 'table') {
      const denied = await assertAdmin(req);
      if (denied) return denied;
    } else if (statusValue !== 'ordered') {
      return NextResponse.json({ error: 'Guests can only create new orders with status "ordered"' }, { status: 400 });
    }

    const items: Array<{
      menuItem: mongoose.Types.ObjectId;
      name: string;
      imageUrl?: string;
      quantity: number;
    }> = [];
    const stockAdjustments = new Map<string, { id: mongoose.Types.ObjectId; quantity: number }>();

    for (const item of itemsInput) {
      const quantity = item.quantity ?? 1;

      let id =
        toObjectId(item.menuItem) ||
        toObjectId(item.itemId) ||
        null;

      let mi: (MenuItemDoc & { _id: mongoose.Types.ObjectId }) | null = null;

      if (!id && item.name) {
        mi = await MenuItem.findOne({ name: item.name.trim() }).lean<MenuItemDoc & { _id: mongoose.Types.ObjectId }>();
        if (mi) id = mi._id;
      } else if (id) {
        mi = await MenuItem.findById(id).lean<MenuItemDoc & { _id: mongoose.Types.ObjectId }>();
      }

      if (!id || !mi) {
        return NextResponse.json(
          { error: `Menu item not found for ${item.name ?? item.menuItem ?? item.itemId}` },
          { status: 400 }
        );
      }

      items.push({
        menuItem: id,
        name: mi.name,
        imageUrl: mi.imageUrl,
        quantity
      });

      if (mi.stock !== undefined && mi.stock !== null) {
        const key = mi._id.toString();
        const existing = stockAdjustments.get(key);
        stockAdjustments.set(key, {
          id: mi._id as mongoose.Types.ObjectId,
          quantity: (existing?.quantity ?? 0) + quantity
        });
      }
    }

    const payload = {
      tableNumber: normalizedTableNumber,
      status: statusValue,
      source: sourceValue,
      ...(notificationPhone ? { notificationPhone } : {}),
      items,
      createdAt: new Date(),
      ...(statusValue === 'served' ? { servedAt: new Date() } : {})
    };

    const doc = await Order.create(payload);

    for (const adjustment of stockAdjustments.values()) {
      try {
        await MenuItem.findByIdAndUpdate(
          adjustment.id,
          [
            {
              $set: {
                stock: {
                  $let: {
                    vars: { current: { $ifNull: ['$stock', 0] } },
                    in: {
                      $max: [
                        { $subtract: ['$$current', adjustment.quantity] },
                        0
                      ]
                    }
                  }
                }
              }
            },
            {
              $set: {
                isAvailable: {
                  $cond: [
                    { $lte: ['$stock', 0] },
                    false,
                    '$isAvailable'
                  ]
                }
              }
            }
          ],
          { new: false }
        );

        const postUpdate = await MenuItem.findById(adjustment.id)
          .select({ stock: 1, lowStockThreshold: 1, name: 1 })
          .lean<{ stock?: number | null; lowStockThreshold?: number | null; name?: string }>();

        if (
          postUpdate &&
          postUpdate.stock !== undefined &&
          postUpdate.stock !== null &&
          postUpdate.stock > 0 &&
          postUpdate.lowStockThreshold !== undefined &&
          postUpdate.lowStockThreshold !== null &&
          postUpdate.stock <= postUpdate.lowStockThreshold
        ) {
          logWarn('menu.low_stock', {
            menuItem: adjustment.id.toString(),
            name: postUpdate.name,
            stock: postUpdate.stock,
            threshold: postUpdate.lowStockThreshold
          });
        }
      } catch (err) {
        logError('menu.stock_update_failed', {
          error: err instanceof Error ? err.message : 'unknown',
          menuItem: adjustment.id.toString()
        });
      }
    }
    clearCache('analytics');

    // Fire SSE event but don't fail the request if it throws
    try {
      broadcast?.('order-created', {
        _id: String(doc._id),
        tableNumber: doc.tableNumber,
        status: doc.status,
        source: doc.source,
        createdAt: doc.createdAt,
        items: doc.items,
      });
    } catch {}

    logInfo('orders.created', {
      orderId: String(doc._id),
      tableNumber: doc.tableNumber,
      status: doc.status,
      source: doc.source
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    logError('orders.create_failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

/** LIST ORDERS */
export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: { Allow: 'OPTIONS,GET' }
      });
    }

    const { searchParams } = new URL(req.url);
    const hours = Math.max(1, Number(searchParams.get('hours') ?? '24'));
    const limit = Math.min(500, Math.max(1, Number(searchParams.get('limit') ?? '250')));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const table = searchParams.get('table');
    const status = searchParams.get('status') as OrderStatus | null;

    const query: Record<string, unknown> = { createdAt: { $gte: since } };
    if (table) {
      const numeric = Number(table);
      query.tableNumber = Number.isNaN(numeric) ? table : { $in: [table, String(numeric), numeric] };
    }
    if (status) query.status = status;

    const orders = await Order.find(query).sort({ createdAt: -1 }).limit(limit).lean();
    return NextResponse.json(orders, { status: 200 });
  } catch (err) {
    logError('orders.fetch_failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
