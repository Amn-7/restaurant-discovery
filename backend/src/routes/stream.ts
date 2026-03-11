import { Router } from 'express';
import { addClient, removeClient } from '../shared/sse.js';

const router = Router();

router.get('/orders', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  // Minimal Express-compatible SSE
  const id = addClient({
    write: async (chunk: Uint8Array) => new Promise<void>((resolve, reject) => {
      res.write(Buffer.from(chunk), (err) => (err ? reject(err) : resolve()));
    }),
    close: () => { try { res.end(); } catch {} }
  } as any);

  const interval = setInterval(() => {
    res.write(`event: ping\ndata: "ok"\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(interval);
    removeClient(id);
  });
});

export default router;
