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

export const sessionMiddleware = ironSession({
  cookieName: 'restaurant_admin',
  password: resolvePassword(),
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: process.env.ADMIN_COOKIE_DOMAIN || undefined
  }
});

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
