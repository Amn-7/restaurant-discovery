// app/api/admin/login/route.ts
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { getSession } from '@/lib/session';
import { loginLimiter } from '@/lib/ratelimit';
import { getRequestIp } from '@/lib/request';

const REMEMBER_ME_MAX_AGE = 60 * 60 * 24 * 30;

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  return NextResponse.json({ authenticated: !!session.admin });
}

export async function POST(req: NextRequest) {
  const adminHash = process.env.ADMIN_KEY_HASH;
  const adminKey = process.env.ADMIN_KEY;
  if (!adminHash && !adminKey) {
    return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 501 });
  }

  const ip = getRequestIp(req);
  const rate = await loginLimiter.limit(`admin-login:${ip}`);
  if (!rate.success) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  const { key = '', rememberMe = false } = await req.json().catch(() => ({}));

  if (process.env.NODE_ENV !== 'production') {
    // 🔎 DEBUG: log minimal, non-sensitive info (disabled in production)
    console.log(
      '[admin/login] keyLen=%d rememberMe=%s runtime=%s',
      key?.length ?? 0,
      rememberMe,
      process.env.NEXT_RUNTIME || 'node'
    );
  }

  let valid = false;

  if (adminHash) {
    try {
      valid = await bcrypt.compare(key, adminHash);
    } catch (err) {
      console.error('[admin/login] Failed to compare admin hash', err);
      return NextResponse.json({ error: 'Admin login is misconfigured.' }, { status: 500 });
    }
  }

  if (!valid && adminKey) {
    const input = Buffer.from(String(key ?? ''), 'utf8');
    const expected = Buffer.from(adminKey, 'utf8');
    if (input.length === expected.length) {
      try {
        valid = timingSafeEqual(input, expected);
      } catch {
        valid = false;
      }
    }
  }

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  const session = await getSession(req, res);
  session.admin = { id: 'admin' };

  if (rememberMe) {
    session.cookieOptions = { ...session.cookieOptions, maxAge: REMEMBER_ME_MAX_AGE };
  } else if (session.cookieOptions?.maxAge !== undefined) {
    const updated = { ...session.cookieOptions };
    delete updated.maxAge;
    session.cookieOptions = updated;
  }

  await session.save();
  return res;
}
