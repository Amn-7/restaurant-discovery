import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function assertAdmin(req: NextRequest): Promise<NextResponse | null> {
  const session = await getSession(req);
  if (session.admin) {
    return null;
  }
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
