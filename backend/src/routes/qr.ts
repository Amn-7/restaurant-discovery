import type { Request, Response } from 'express';
import { Router } from 'express';
import QRCode from 'qrcode';

const router = Router();

const defaultBase = process.env.PUBLIC_SITE_URL || 'http://localhost:3000';

const buildTableUrl = (req: Request, table: string) => {
  if (process.env.PUBLIC_SITE_URL) return new URL(`/t/${encodeURIComponent(table)}`, process.env.PUBLIC_SITE_URL).toString();
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0];
  const host = req.get('x-forwarded-host') || req.get('host');
  if (host) {
    return `${proto}://${host}/t/${encodeURIComponent(table)}`;
  }
  return new URL(`/t/${encodeURIComponent(table)}`, defaultBase).toString();
};

router.get('/', async (req: Request, res: Response) => {
  const tableRaw = (req.query.table ?? '').toString().trim();
  if (!tableRaw) {
    return res.status(400).json({ error: 'table is required' });
  }
  const target = buildTableUrl(req, tableRaw);
  try {
    const png = await QRCode.toBuffer(target, {
      type: 'png',
      margin: 1,
      width: 512,
      errorCorrectionLevel: 'M'
    });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

export default router;
