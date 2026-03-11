import './env.js';
import type { Request, Response, NextFunction } from 'express';
import { ironSession } from 'iron-session/express';

const DEV_FALLBACK_PASSWORD = 'dev-session-password-change-me-please-0123456789';

function resolvePassword(): string {
  const configured = process.env.IRON_SESSION_PASSWORD;
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('IRON_SESSION_PASSWORD must be set (32+ chars)');
  }
  return DEV_FALLBACK_PASSWORD;
}

const DEFAULT_TTL = 24 * 60 * 60; // 1 day in seconds
const REMEMBER_ME_TTL = 30 * 24 * 60 * 60; // 30 days in seconds

function createSessionOptions(ttl: number = DEFAULT_TTL) {
  return {
    cookieName: 'restaurant_admin',
    password: resolvePassword(),
    ttl,
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: ttl,
      domain: process.env.ADMIN_COOKIE_DOMAIN || undefined
    }
  };
}

export const sessionMiddleware = ironSession(createSessionOptions());
export const rememberMeSessionMiddleware = ironSession(createSessionOptions(REMEMBER_ME_TTL));

export type AdminSession = {
  admin?: { id: string };
};

declare module 'iron-session' {
  interface IronSessionData extends AdminSession {}
}

export function assertAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
