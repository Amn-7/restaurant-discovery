type CacheRecord<T> = {
  value: T;
  expiresAt: number;
  promise?: Promise<T>;
};

const globalCache: Map<string, CacheRecord<unknown>> =
  (globalThis as unknown as { __appCache?: Map<string, CacheRecord<unknown>> }).__appCache ??
  new Map<string, CacheRecord<unknown>>();

(globalThis as unknown as { __appCache?: Map<string, CacheRecord<unknown>> }).__appCache = globalCache;

export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  factory: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const existing = globalCache.get(key) as CacheRecord<T> | undefined;

  if (existing) {
    if (existing.expiresAt > now && existing.promise === undefined) {
      return existing.value;
    }
    if (existing.promise) {
      return existing.promise;
    }
  }

  const record: CacheRecord<T> = {
    value: existing?.value as T,
    expiresAt: now + ttlMs
  };
  const promise = factory()
    .then((result) => {
      record.value = result;
      record.expiresAt = Date.now() + ttlMs;
      record.promise = undefined;
      globalCache.set(key, record);
      return result;
    })
    .catch((err) => {
      if (existing) {
        record.value = existing.value;
        record.expiresAt = existing.expiresAt;
      } else {
        globalCache.delete(key);
      }
      record.promise = undefined;
      throw err;
    });

  record.promise = promise;
  globalCache.set(key, record);
  return promise;
}

export function clearCache(prefix?: string) {
  if (!prefix) {
    globalCache.clear();
    return;
  }
  for (const key of globalCache.keys()) {
    if (key.startsWith(prefix)) {
      globalCache.delete(key);
    }
  }
}
