export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { dbConnect } from '@/lib/db';
import MenuItem, { type MenuItemDoc } from '@/models/MenuItem';
import { assertAdmin } from '@/lib/auth';
import { ensureDemoData } from '@/lib/demoSeed';
import { Types } from 'mongoose';
import { createMenuItemSchema } from '@/lib/validators';
import { writeLimiter } from '@/lib/ratelimit';
import { clearCache } from '@/lib/cache';
import { getRequestIp } from '@/lib/request';

type LeanMenuItem = Omit<MenuItemDoc, '_id'> & { _id: Types.ObjectId };
type NormalizedMenuItem = Omit<MenuItemDoc, '_id'> & { _id: string };

function normalizeMenuItem(doc: LeanMenuItem): NormalizedMenuItem {
  const { _id, ...rest } = doc;
  return {
    ...rest,
    _id: _id.toString()
  };
}

export async function GET() {
  await dbConnect();
  await ensureDemoData();
  const items = await MenuItem.find({}).sort({ createdAt: -1 }).lean<LeanMenuItem[]>();
  const normalized = items.map(normalizeMenuItem);
  return NextResponse.json(normalized, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { Allow: 'OPTIONS,GET,POST' }
  });
}

async function authorizeWithHeader(req: NextRequest): Promise<boolean> {
  const adminKey = req.headers.get('x-admin-key');
  const adminHash = process.env.ADMIN_KEY_HASH;
  if (!adminKey || !adminHash) return false;
  try {
    return await bcrypt.compare(adminKey, adminHash);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  await dbConnect();
  const denied = await assertAdmin(req);
  if (denied && !(await authorizeWithHeader(req))) return denied;

  const ip = getRequestIp(req);
  const rate = await writeLimiter.limit(`menu:create:${ip}`);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createMenuItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = { ...parsed.data };

  if (payload.stock !== undefined) {
    if (payload.stock === null) {
      payload.stock = null;
    } else {
      payload.stock = Math.max(0, Math.trunc(payload.stock));
      if (payload.stock === 0) {
        payload.isAvailable = false;
      }
    }
  }
  if (payload.lowStockThreshold !== undefined) {
    if (payload.lowStockThreshold === null) {
      payload.lowStockThreshold = null;
    } else {
      payload.lowStockThreshold = Math.max(0, Math.trunc(payload.lowStockThreshold));
      if (
        payload.stock !== undefined &&
        payload.stock !== null &&
        payload.lowStockThreshold > payload.stock
      ) {
        payload.lowStockThreshold = payload.stock;
      }
    }
  }

  const doc = await MenuItem.create(payload);
  const createdObject = doc.toObject({ depopulate: true }) as LeanMenuItem;
  clearCache('analytics');
  return NextResponse.json(normalizeMenuItem(createdObject), { status: 201 });
}
