// Simple in-memory SSE hub (dev-friendly; use Redis/etc. in prod)
let lastId = 0;
const clients = new Map<number, WritableStreamDefaultWriter<Uint8Array>>();
const encoder = new TextEncoder();

export function addClient(writer: WritableStreamDefaultWriter<Uint8Array>) {
  const id = ++lastId;
  clients.set(id, writer);
  // greet + keep-alive immediately
  writer.write(encoder.encode(`event: ping\ndata: "ok"\n\n`));
  return id;
}

export function removeClient(id: number) {
  const w = clients.get(id);
  try { w?.close(); } catch {}
  clients.delete(id);
}

export type BroadcastPayload = Record<string, unknown>;

export function broadcast(event: 'order-created'|'order-updated', data: BroadcastPayload) {
  const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  for (const [id, w] of clients) {
    w.write(payload).catch(() => clients.delete(id));
  }
}
