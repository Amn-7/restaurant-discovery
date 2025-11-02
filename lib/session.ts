import { getIronSession } from 'iron-session/edge';
import type { IronSessionOptions } from 'iron-session/edge';
import type { IronSession } from 'iron-session';
import type { NextRequest } from 'next/server';
import type { CookieSerializeOptions } from 'cookie';

export type AdminSession = IronSession & {
  admin?: { id: string; email?: string };
  cookieOptions: CookieSerializeOptions;
};

const DEV_FALLBACK_PASSWORD = 'dev-session-password-change-me-please-0123456789';
let warnedAboutSessionPassword = false;

function resolvePassword(): string {
  const configured = process.env.IRON_SESSION_PASSWORD;
  if (configured && configured.length >= 32) {
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('IRON_SESSION_PASSWORD must be set to a 32+ character secret in production');
  }

  if (!warnedAboutSessionPassword) {
    console.warn('[session] Using insecure fallback password. Set IRON_SESSION_PASSWORD for secure admin sessions.');
    warnedAboutSessionPassword = true;
  }

  return DEV_FALLBACK_PASSWORD;
}

const sessionOptions: IronSessionOptions = {
  password: resolvePassword(),
  cookieName: 'restaurant_admin',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    httpOnly: true
  }
};

export async function getSession(req: NextRequest, res?: Response): Promise<AdminSession> {
  const response = res ?? new Response();
  const session = await getIronSession(req, response, sessionOptions);
  return session as AdminSession;
}

export { sessionOptions as adminSessionOptions };
