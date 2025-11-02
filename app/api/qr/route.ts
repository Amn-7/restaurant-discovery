export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const table = url.searchParams.get('table') ?? '1';

    // Build a table-specific URL like https://host/t/5
    const origin = `${url.protocol}//${url.host}`;
    const target = `${origin}/t/${encodeURIComponent(table)}`;

    const pngBuffer = await QRCode.toBuffer(target, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
      type: 'png'
    });

    const pngBytes = new Uint8Array(pngBuffer);

    return new NextResponse(pngBytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (err) {
    console.error('QR error', err);
    return NextResponse.json({ error: 'Failed to generate QR' }, { status: 500 });
  }
}
