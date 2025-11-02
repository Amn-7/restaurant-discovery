export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse, NextRequest } from 'next/server';
import { dbConnect } from '@/lib/db';
import Order from '@/models/Order';
import type { OrderDoc } from '@/models/Order';
import { broadcast } from '@/lib/sse';
import mongoose, { Types } from 'mongoose';
import { assertAdmin } from '@/lib/auth';
import { ensureDemoData } from '@/lib/demoSeed';
import { writeLimiter } from '@/lib/ratelimit';
import { updateOrderStatusSchema } from '@/lib/validators';
import { clearCache } from '@/lib/cache';
import { getRequestIp } from '@/lib/request';
import { logError, logInfo, logWarn } from '@/lib/logger';

type OrderStatus = NonNullable<OrderDoc['status']>;

type LeanOrderItem = {
  menuItem?: Types.ObjectId | null;
  name: string;
  imageUrl?: string;
  quantity: number;
};

type LeanOrder = {
  _id: Types.ObjectId;
  tableNumber: string;
  items: LeanOrderItem[];
  status: OrderStatus;
  servedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type NormalizedOrderItem = Omit<LeanOrderItem, 'menuItem'> & { menuItem: string | null };
type NormalizedOrder = Omit<LeanOrder, '_id' | 'items'> & {
  _id: string;
  items: NormalizedOrderItem[];
};

const normalizeOrder = (order: LeanOrder): NormalizedOrder => ({
  _id: order._id.toString(),
  tableNumber: order.tableNumber,
  status: order.status,
  servedAt: order.servedAt ?? null,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  items: (order.items ?? []).map((item) => ({
    ...item,
    menuItem: item.menuItem ? item.menuItem.toString() : null
  }))
});

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'OPTIONS,GET,PATCH,PUT' }
  });
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    await ensureDemoData();
    const denied = await assertAdmin(req);
    if (denied) return denied;

    const ip = getRequestIp(req);
    const rate = await writeLimiter.limit(`orders:update:${ip}`);
    if (!rate.success) {
      logWarn('orders.update_rate_limited', { ip });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const parsed = updateOrderStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const update: Partial<Pick<LeanOrder, 'status' | 'servedAt'>> = {
      status: parsed.data.status as OrderStatus
    };
    if (parsed.data.status === 'served') {
      update.servedAt = new Date();
    }

    const doc = await Order.findByIdAndUpdate(id, update, { new: true }).lean<LeanOrder>();
    if (!doc) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const normalized = normalizeOrder(doc);
    clearCache('analytics');
    broadcast('order-updated', {
      _id: normalized._id,
      status: normalized.status,
      servedAt: normalized.servedAt ?? null
    });

    logInfo('orders.status_updated', {
      orderId: normalized._id,
      status: normalized.status
    });

    return NextResponse.json(normalized, { status: 200 });
  } catch (err) {
    logError('orders.patch_failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    await ensureDemoData();
    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const doc = await Order.findById(id).lean<LeanOrder>();
    if (!doc) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeOrder(doc), { status: 200 });
  } catch (err) {
    logError('orders.fetch_one_failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    await ensureDemoData();
    const denied = await assertAdmin(req);
    if (denied) return denied;

    const ip = getRequestIp(req);
    const rate = await writeLimiter.limit(`orders:update:${ip}`);
    if (!rate.success) {
      logWarn('orders.update_rate_limited', { ip });
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const parsed = updateOrderStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
    }

    const status = parsed.data.status as OrderStatus;
    const update: Partial<Pick<LeanOrder, 'status' | 'servedAt'>> = {
      status,
      servedAt: status === 'served' ? new Date() : undefined
    };

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const updated = await Order.findByIdAndUpdate(id, update, { new: true }).lean<LeanOrder>();
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const normalized = normalizeOrder(updated);
    clearCache('analytics');
    broadcast('order-updated', {
      _id: normalized._id,
      status: normalized.status,
      servedAt: normalized.servedAt ?? null
    });

    logInfo('orders.status_replaced', {
      orderId: normalized._id,
      status: normalized.status
    });

    return NextResponse.json(normalized, { status: 200 });
  } catch (err) {
    logError('orders.put_failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}
