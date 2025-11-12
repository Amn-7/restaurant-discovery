export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { dbConnect } from '@/lib/db';

export async function GET() {
  const envs = {
    hasMongoUri: Boolean(process.env.MONGODB_URI),
    nodeEnv: process.env.NODE_ENV || 'undefined'
  };

  try {
    await dbConnect();
    const ready = mongoose.connection.readyState === 1; // connected
    return NextResponse.json({ ok: true, db: ready ? 'connected' : 'not_connected', envs }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ ok: false, error: 'db_connect_failed', message, envs }, { status: 500 });
  }
}

