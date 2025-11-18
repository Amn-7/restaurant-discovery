import type { Request, Response, NextFunction } from 'express';

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

function keyFor(req: Request, prefix: string) {
  const ip = (req.ip || req.headers['x-forwarded-for'] || 'unknown').toString();
  return `${prefix}:${ip}`;
}

function inMemoryLimiter(name: string, requests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    // Use a distinct prefix per limiter to avoid cross-contamination
    const key = keyFor(req, `rl:${name}`);
    const entry = store.get(key);
    if (!entry || entry.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count < requests) {
      entry.count += 1;
      return next();
    }
    const retryMs = Math.max(0, entry.resetAt - now);
    res.setHeader('Retry-After', Math.ceil(retryMs / 1000));
    return res.status(429).json({ error: 'Too many requests' });
  };
}

// Export specific limiters
export const loginLimiter = inMemoryLimiter('login', 5, 60_000); // 5 per minute per IP
export const writeLimiter = inMemoryLimiter('write', 20, 60_000); // 20 per minute per IP
