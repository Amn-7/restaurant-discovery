let lastId = 0;
const clients = new Map<number, { write: (chunk: Uint8Array) => Promise<void>; close: () => void }>();
const encoder = new TextEncoder();

export function addClient(writer: { write: (chunk: Uint8Array) => Promise<void>; close: () => void }) {
  const id = ++lastId;
  clients.set(id, writer);
  writer.write(encoder.encode(`event: ping\ndata: "ok"\n\n`)).catch(() => {});
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

