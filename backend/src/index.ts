import './env.js';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { sessionMiddleware } from './session.js';
import { dbConnect } from './db.js';
import { requestLogger, errorHandler } from './middleware/observability.js';
import menuRouter from './routes/menu.js';
import ordersRouter from './routes/orders.js';
import reviewsRouter from './routes/reviews.js';
import adminRouter from './routes/admin.js';
import analyticsRouter from './routes/analytics.js';
import uploadRouter from './routes/upload.js';
import streamRouter from './routes/stream.js';
import exportRouter from './routes/export.js';
import diagnosticsRouter from './routes/diagnostics.js';

const app = express();

// Behind a reverse proxy (e.g., Vercel/NGINX/App Service) trust X-Forwarded-* headers
// This ensures secure cookies and protocol detection behave correctly in production
app.set('trust proxy', 1);

// Optional CORS (not needed if front-end proxies requests)
if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
}

// Request logging (JSON) with x-request-id and duration
app.use(requestLogger);

app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(sessionMiddleware);

app.get('/', (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'restaurant-api',
    uptimeSec: Math.round(process.uptime())
  });
});

app.get('/api/health', async (_req, res) => {
  try {
    await dbConnect();
    const mem = process.memoryUsage();
    res.json({
      ok: true,
      db: 'connected',
      nodeEnv: process.env.NODE_ENV || 'unset',
      uptimeSec: Math.round(process.uptime()),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'unknown' });
  }
});

app.use('/api/menu', menuRouter);
app.use('/api/orders/export', exportRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/stream', streamRouter);
app.use('/api/db', diagnosticsRouter);

// Error handler (structured JSON logs)
app.use(errorHandler);

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[api] listening on :${port}`);
});
