export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { dbConnect } from '@/lib/db';
import MenuItem, { type MenuItemDoc } from '@/models/MenuItem';
import mongoose, { Types } from 'mongoose';
import { assertAdmin } from '@/lib/auth';
import { ensureDemoData } from '@/lib/demoSeed';
import { updateMenuItemSchema } from '@/lib/validators';
import { writeLimiter } from '@/lib/ratelimit';
import { clearCache } from '@/lib/cache';
import { getRequestIp } from '@/lib/request';

type LeanMenuItem = Omit<MenuItemDoc, '_id'> & { _id: Types.ObjectId };
type NormalizedMenuItem = Omit<MenuItemDoc, '_id'> & { _id: string };

const normalizeMenuItem = (item: LeanMenuItem): NormalizedMenuItem => {
  const { _id, ...rest } = item;
  return {
    ...rest,
    _id: _id.toString()
  };
};

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  await dbConnect();
  await ensureDemoData();
  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  const item = await MenuItem.findById(id).lean<LeanMenuItem>();
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(normalizeMenuItem(item), { status: 200 });
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const denied = await assertAdmin(req);
  if (denied) return denied;

  const ip = getRequestIp(req);
  const rate = await writeLimiter.limit(`menu:update:${ip}`);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = updateMenuItemSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const updated = await MenuItem.findByIdAndUpdate(id, parsed.data, { new: true }).lean<LeanMenuItem>();
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  clearCache('analytics');
  return NextResponse.json(normalizeMenuItem(updated), { status: 200 });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  await dbConnect();
  const denied = await assertAdmin(req);
  if (denied) return denied;

  const ip = getRequestIp(req);
  const rate = await writeLimiter.limit(`menu:delete:${ip}`);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  await MenuItem.findByIdAndDelete(id);
  clearCache('analytics');
  return NextResponse.json({ ok: true }, { status: 200 });
}
