import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { POST as loginPOST, GET as loginGET } from '@/app/api/admin/login/route';
import { POST as logoutPOST } from '@/app/api/admin/logout/route';

const adminLoginUrl = 'http://localhost/api/admin/login';
const adminLogoutUrl = 'http://localhost/api/admin/logout';

const ADMIN_KEY = 'aman';

beforeAll(() => {
  if (!process.env.IRON_SESSION_PASSWORD || process.env.IRON_SESSION_PASSWORD.length < 32) {
    process.env.IRON_SESSION_PASSWORD = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJ';
  }
  process.env.ADMIN_KEY_HASH = bcrypt.hashSync(ADMIN_KEY, 10);
  delete process.env.ADMIN_KEY;
  // Note: NODE_ENV is read-only in some environments, but for tests we can set it
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
});

async function performLogin(key = ADMIN_KEY, rememberMe = false) {
  const request = new NextRequest(adminLoginUrl, {
    method: 'POST',
    body: JSON.stringify({ key, rememberMe }),
    headers: { 'content-type': 'application/json' }
  });
  return loginPOST(request);
}

describe('Admin authentication API', () => {
  it('rejects invalid admin credentials', async () => {
    const response = await performLogin('wrong-key');
    expect(response.status).toBe(401);
  });

  it('signs in the admin and returns a session cookie', async () => {
    const response = await performLogin(ADMIN_KEY, true);
    expect(response.status).toBe(200);

    const cookie = response.headers.get('set-cookie');
    expect(cookie).toBeTruthy();
    expect(cookie).toContain('restaurant_admin');

    const body = await response.json();
    expect(body.ok).toBe(true);

    const statusRequest = new NextRequest(adminLoginUrl, {
      method: 'GET',
      headers: { cookie: cookie ?? '' }
    });
    const statusResponse = await loginGET(statusRequest);
    const statusBody = await statusResponse.json();
    expect(statusBody.authenticated).toBe(true);

    const logoutRequest = new NextRequest(adminLogoutUrl, {
      method: 'POST',
      headers: { cookie: cookie ?? '' }
    });
    const logoutResponse = await logoutPOST(logoutRequest);
    expect(logoutResponse.status).toBe(200);

    const cleared = logoutResponse.headers.get('set-cookie');
    expect(cleared).toContain('restaurant_admin=');
  });
});
