import { ReactNode } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';

type Props = { children: ReactNode };

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function ensureAdminSession() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map((c) => `${c.name}=${c.value}`).join('; ');
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  const origin = host ? `${proto}://${host}` : '';

  try {
    const res = await fetch(`${origin}/api/admin/login`, {
      method: 'GET',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
      cache: 'no-store'
    });
    if (!res.ok) return false;
    const json = await res.json().catch(() => null);
    return Boolean(json?.authenticated);
  } catch {
    return false;
  }
}

export default async function AdminProtectedLayout({ children }: Props) {
  const ok = await ensureAdminSession();
  if (!ok) {
    redirect('/admin/login');
  }
  return <>{children}</>;
}
