export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { dbConnect } from '@/lib/db';
import Order from '@/models/Order';
import { Types } from 'mongoose';

type OrderStatus = 'ordered' | 'preparing' | 'served';

function parseFilters(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const hours = Math.max(1, Number(searchParams.get('hours') ?? '24'));
  const table = searchParams.get('table');
  const status = searchParams.get('status') as OrderStatus | null;
  const format = (searchParams.get('format') ?? 'pdf').toLowerCase();
  return { hours, table, status, format };
}

type LeanOrder = {
  _id: Types.ObjectId;
  tableNumber?: string | number;
  status?: OrderStatus;
  items?: Array<{ name?: string; quantity?: number; menuItem?: Types.ObjectId | string | null }>;
  createdAt: Date;
  servedAt?: Date | null;
};

async function fetchOrders(hours: number, table: string | null, status: OrderStatus | null) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const query: Record<string, unknown> = { createdAt: { $gte: since } };
  if (table) {
    const numeric = Number(table);
    query.tableNumber = Number.isNaN(numeric) ? table : { $in: [table, String(numeric), numeric] };
  }
  if (status) query.status = status;
  const docs = await Order.find(query).sort({ createdAt: -1 }).lean<LeanOrder[]>();
  return docs;
}

function formatDate(value: Date | string) {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

async function buildPdfResponse(orders: LeanOrder[], filters: { hours: number; table: string | null; status: OrderStatus | null }) {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const contentWidth = () => page.getWidth() - margin * 2;
  let y = page.getHeight() - margin;

  const ensureSpace = (height: number) => {
    if (y - height <= margin) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = page.getHeight() - margin;
    }
  };

  const wrapText = (text: string, size: number, font: typeof regularFont) => {
    const maxWidth = contentWidth();
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, size);
      if (width <= maxWidth) {
        line = testLine;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const addText = (text: string, opts?: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; spacing?: number }) => {
    const size = opts?.size ?? 12;
    const font = opts?.bold ? boldFont : regularFont;
    const color = opts?.color ?? rgb(0, 0, 0);
    const lines = wrapText(text, size, font);
    lines.forEach((line) => {
      ensureSpace(size + (opts?.spacing ?? 4));
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color
      });
      y -= size + (opts?.spacing ?? 4);
    });
  };

  addText('Order History', { size: 20, bold: true, spacing: 12 });
  const subtitleParts = [`Last ${filters.hours}h`];
  if (filters.status) subtitleParts.push(`Status: ${filters.status}`);
  if (filters.table) subtitleParts.push(`Table: ${filters.table}`);
  addText(subtitleParts.join(' • '), { size: 12, color: rgb(0.35, 0.35, 0.35), spacing: 16 });

  if (!orders.length) {
    addText('No orders found for the selected filters.', { size: 12 });
  } else {
    orders.forEach((order, index) => {
      addText(`Order #${String(order._id).slice(-6)} • Table ${order.tableNumber ?? '—'}`, {
        size: 14,
        bold: true,
        spacing: 8
      });
      addText(`Status: ${order.status ?? 'unknown'} • Created: ${formatDate(order.createdAt)}`, {
        size: 11,
        color: rgb(0.3, 0.3, 0.3)
      });
      if (order.servedAt) {
        addText(`Served: ${formatDate(order.servedAt)}`, { size: 11, color: rgb(0.3, 0.3, 0.3) });
      }
      if (Array.isArray(order.items) && order.items.length) {
        order.items.forEach((item) => {
          addText(`• ${item.name ?? 'Dish'} × ${item.quantity ?? 1}`, { size: 11, color: rgb(0.15, 0.15, 0.15) });
        });
      }
      if (index < orders.length - 1) {
        y -= 8;
        ensureSpace(12);
        page.drawRectangle({
          x: margin,
          y,
          width: contentWidth(),
          height: 0.5,
          color: rgb(0.85, 0.85, 0.85)
        });
        y -= 16;
      }
    });
  }

  const bytes = await pdfDoc.save();
  const buffer = Buffer.from(bytes);
  const filename = `orders-${Date.now()}.pdf`;
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}

export async function GET(req: NextRequest) {
  try {
    const { hours, table, status, format } = parseFilters(req);
    await dbConnect();
    const orders = await fetchOrders(hours, table, status);

    if (format !== 'pdf') {
      return NextResponse.json({ error: `Unsupported export format: ${format}` }, { status: 400 });
    }

    return await buildPdfResponse(orders, { hours, table, status });
  } catch (err) {
    console.error('orders export failed', err);
    return NextResponse.json({ error: 'Failed to export orders' }, { status: 500 });
  }
}
