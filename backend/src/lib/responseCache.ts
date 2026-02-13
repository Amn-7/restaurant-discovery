type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const cache = new Map<string, CacheEntry>();

const now = () => Date.now();

const cleanupExpired = () => {
  const current = now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= current) cache.delete(key);
  }
};

export const invalidateCache = (prefix?: string) => {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
};

export const withCache = async <T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<{ value: T; hit: boolean }> => {
  const entry = cache.get(key);
  const current = now();
  if (entry && entry.expiresAt > current) {
    return { value: entry.value as T, hit: true };
  }

  const value = await loader();
  cache.set(key, { value, expiresAt: current + Math.max(250, ttlMs) });
  if (cache.size > 512) cleanupExpired();
  return { value, hit: false };
};
