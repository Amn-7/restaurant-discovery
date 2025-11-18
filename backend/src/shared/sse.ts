import Redis from 'ioredis';

type SSEWriter = { write: (chunk: Uint8Array) => Promise<void>; close: () => void };

let lastId = 0;
const clients = new Map<number, SSEWriter>();
const encoder = new TextEncoder();

const instanceId = `${process.pid}:${Math.random().toString(36).slice(2)}`;
const redisUrl = process.env.SSE_REDIS_URL || process.env.REDIS_URL || '';
const redisChannel = process.env.SSE_REDIS_CHANNEL || 'sse:orders';

let redisPublisher: Redis | null = null;
let redisSubscriber: Redis | null = null;

if (redisUrl) {
  const options = { lazyConnect: true, maxRetriesPerRequest: 0 } as const;
  try {
    redisPublisher = new Redis(redisUrl, options);
    redisSubscriber = new Redis(redisUrl, options);
    redisSubscriber.on('message', (_channel, message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed?.origin === instanceId) return;
        if (parsed?.event && parsed?.data) {
          dispatch(parsed.event, parsed.data);
        }
      } catch (err) {
        console.warn('[sse] failed to parse redis payload', err);
      }
    });
    redisSubscriber.subscribe(redisChannel).catch((err) => {
      console.warn(`[sse] redis subscribe failed: ${err instanceof Error ? err.message : 'unknown'}`);
    });
    console.log(`[sse] redis pub/sub enabled on ${redisChannel}`);
  } catch (err) {
    console.warn('[sse] redis setup failed, falling back to in-memory only', err);
    redisPublisher = null;
    redisSubscriber = null;
  }
}

function dispatch(event: 'order-created'|'order-updated', data: BroadcastPayload) {
  const payload = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  for (const [id, w] of clients) {
    w.write(payload).catch(() => clients.delete(id));
  }
}

export function addClient(writer: SSEWriter) {
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
  dispatch(event, data);
  if (redisPublisher) {
    const payload = JSON.stringify({ origin: instanceId, event, data });
    redisPublisher.publish(redisChannel, payload).catch((err) => {
      console.warn('[sse] failed to publish redis event', err instanceof Error ? err.message : err);
    });
  }
}
