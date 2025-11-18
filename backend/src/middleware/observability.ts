import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

function hrtimeMs(start: bigint) {
  const diff = process.hrtime.bigint() - start;
  return Number(diff) / 1_000_000;
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  const reqId = (req.headers['x-request-id'] as string | undefined) || randomUUID();
  res.setHeader('x-request-id', reqId);

  const startLog = {
    level: 'info',
    message: 'request.start',
    id: reqId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip,
    ua: req.headers['user-agent'] || '' ,
    ts: new Date().toISOString()
  };
  console.log(JSON.stringify(startLog));

  res.on('finish', () => {
    const log = {
      level: 'info',
      message: 'request.end',
      id: reqId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Math.round(hrtimeMs(start)),
      length: Number(res.getHeader('content-length') || 0),
      ts: new Date().toISOString()
    };
    console.log(JSON.stringify(log));
  });

  next();
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const reqId = (res.getHeader('x-request-id') as string) || (req.headers['x-request-id'] as string) || '';
  const payload = {
    level: 'error',
    message: 'request.error',
    id: reqId,
    path: req.originalUrl || req.url,
    error: err instanceof Error ? err.message : 'unknown',
    ts: new Date().toISOString()
  };
  console.error(JSON.stringify(payload));
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Server Error', id: reqId });
  }
}

