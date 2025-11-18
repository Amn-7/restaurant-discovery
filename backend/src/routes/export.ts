import { Router } from 'express';
import { dbConnect } from '../db.js';
import Order from '../shared/models/Order.js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const router = Router();

router.get('/', async (req, res) => {
  try {
    await dbConnect();
    const { hours = '24', table, status, format = 'pdf' } = req.query as Record<string, string>;
    if (format !== 'pdf') return res.status(400).json({ error: `Unsupported export format: ${format}` });
    const since = new Date(Date.now() - Math.max(1, Number(hours)) * 60 * 60 * 1000);
    const query: any = { createdAt: { $gte: since } };
    if (table) {
      const numeric = Number(table);
      query.tableNumber = Number.isNaN(numeric) ? table : { $in: [table, String(numeric), numeric] };
    }
    if (status) query.status = status;
    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 48;
    const contentWidth = () => page.getWidth() - margin * 2;
    let y = page.getHeight() - margin;
    const ensureSpace = (h: number) => { if (y - h <= margin) { page = pdfDoc.addPage([595.28, 841.89]); y = page.getHeight() - margin; } };
    const wrap = (text: string, size: number, font: any) => {
      const words = text.split(/\s+/); const lines: string[] = []; let line = '';
      for (const w of words) { const t = line ? `${line} ${w}` : w; const width = font.widthOfTextAtSize(t, size); if (width <= contentWidth()) line = t; else { if (line) lines.push(line); line = w; } }
      if (line) lines.push(line); return lines;
    };
    const addText = (text: string, opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; spacing?: number }) => {
      const size = opts?.size ?? 12; const font = opts?.bold ? boldFont : regularFont; const color = opts?.color ?? rgb(0,0,0);
      const lines = wrap(text, size, font); for (const line of lines) { ensureSpace(size + (opts?.spacing ?? 4)); page.drawText(line, { x: margin, y, size, font, color }); y -= size + (opts?.spacing ?? 4); }
    };

    addText('Order History', { size: 20, bold: true, spacing: 12 });
    addText(`Last ${hours}h`, { size: 12, color: rgb(0.35,0.35,0.35), spacing: 16 });
    for (const order of orders) {
      addText(`Order #${String(order._id).slice(-6)} • Table ${order.tableNumber ?? '—'}`, { size: 14, bold: true, spacing: 8 });
      const created = new Date(order.createdAt).toLocaleString();
      addText(`Status: ${order.status ?? 'unknown'} • Created: ${created}`, { size: 11, color: rgb(0.3,0.3,0.3) });
      if (order.servedAt) addText(`Served: ${new Date(order.servedAt).toLocaleString()}`, { size: 11, color: rgb(0.3,0.3,0.3) });
      if (Array.isArray(order.items)) order.items.forEach((it: any) => addText(`• ${it.name ?? 'Dish'} × ${it.quantity ?? 1}`, { size: 11, color: rgb(0.15,0.15,0.15) }));
      y -= 8; ensureSpace(12); page.drawRectangle({ x: margin, y, width: contentWidth(), height: 0.5, color: rgb(0.85,0.85,0.85) }); y -= 16;
    }

    const bytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${Date.now()}.pdf"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    res.status(500).json({ error: 'Failed to export orders' });
  }
});

export default router;
