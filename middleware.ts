import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/session';

const PROTECTED_PATHS = ['/admin', '/api/menu', '/api/orders', '/api/reviews'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isAdminPage = pathname.startsWith('/admin') && !pathname.startsWith('/admin/login');
  const isApiPath = PROTECTED_PATHS.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );
  const method = req.method ?? 'GET';
  const isSafeMethod = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const allowsGuestPost =
    method === 'POST' &&
    (pathname === '/api/orders' ||
      pathname === '/api/orders/' ||
      pathname === '/api/reviews' ||
      pathname === '/api/reviews/');
  const isProtectedApi = isApiPath && !(isSafeMethod || allowsGuestPost);

  if (!isAdminPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const session = await getSession(req, res);

  if (!session.admin) {
    if (isAdminPage) {
      const loginUrl = new URL('/admin/login', req.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return res;
}

export const config = {
  matcher: ['/admin/:path*', '/api/menu/:path*', '/api/orders/:path*', '/api/reviews/:path*']
};
