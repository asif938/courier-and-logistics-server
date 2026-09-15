import { isRedisReady, redis } from '../config/redis';

export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (!isRedisReady()) {
    return fetcher();
  }

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    return fetcher();
  }

  const fresh = await fetcher();
  redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds).catch(() => {});
  return fresh;
}

export async function invalidateCache(key: string): Promise<void> {
  if (!isRedisReady()) {
    return;
  }
  try {
    await redis.del(key);
  } catch {}
}
