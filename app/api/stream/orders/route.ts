export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { addClient, removeClient } from '@/lib/sse';

export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const id = addClient(writer);
  const interval = setInterval(() => {
    // keep-alive every 25s
    writer.write(new TextEncoder().encode(`event: ping\ndata: "ok"\n\n`)).catch(() => {});
  }, 25000);

  const abort = () => {
    clearInterval(interval);
    removeClient(id);
  };
  req.signal.addEventListener('abort', abort);

  return new Response(readable, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*' // same-origin anyway
    }
  });
}
