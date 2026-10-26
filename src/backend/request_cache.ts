import { createHash } from 'node:crypto';

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

export interface RequestCacheOptions {
  /** Override the environment-derived TTL in seconds. */
  ttlSeconds?: number;
  /** Environment variable to read when ttlSeconds is not supplied. */
  ttlEnvVar?: string;
  defaultTtlSeconds?: number;
  maxEntries?: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

export function secretFingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function ttlFor(options: RequestCacheOptions): number {
  let seconds = options.ttlSeconds;
  if (seconds === undefined) {
    const name = options.ttlEnvVar || 'API_CACHE_TTL_SECONDS';
    const raw = (process.env[name] || '').trim();
    const parsed = raw ? Number(raw) : (options.defaultTtlSeconds ?? 300);
    seconds = Number.isFinite(parsed) && parsed >= 0 ? parsed : (options.defaultTtlSeconds ?? 300);
  }
  return Math.min(86_400, Math.max(0, seconds));
}

function requestHash(namespace: string, descriptor: unknown): string {
  return createHash('sha256').update(JSON.stringify([namespace, descriptor])).digest('hex');
}

function trimCache(now: number, maxEntries: number): void {
  for (const [key, value] of responseCache) {
    if (value.expiresAt <= now) responseCache.delete(key);
  }
  if (responseCache.size > maxEntries) {
    const oldest = [...responseCache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    oldest.slice(0, responseCache.size - maxEntries).forEach(([key]) => responseCache.delete(key));
  }
}

/**
 * Cache successful external-provider requests by a hash of their normalized inputs.
 * Concurrent identical calls share one promise; rejected requests are never cached.
 */
export async function withRequestCache<T>(
  namespace: string,
  descriptor: unknown,
  loader: () => Promise<T>,
  options: RequestCacheOptions = {}
): Promise<T> {
  const ttlSeconds = ttlFor(options);
  const maxEntries = Math.max(1, Math.min(5000, Math.floor(options.maxEntries ?? 1000)));
  const now = Date.now();
  trimCache(now, maxEntries);
  const key = requestHash(namespace, descriptor);
  const cached = responseCache.get(key);
  if (ttlSeconds > 0 && cached && cached.expiresAt > now) return cached.value as T;

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const request = Promise.resolve().then(loader);
  inFlight.set(key, request);
  try {
    const value = await request;
    if (ttlSeconds > 0) responseCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return value;
  } finally {
    inFlight.delete(key);
  }
}
