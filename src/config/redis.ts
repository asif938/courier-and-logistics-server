import Redis from 'ioredis';
import { env } from './env';

export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy(times) {
    return Math.min(times * 500, 10000);
  },
});

export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

let hasLoggedConnectionWarning = false;

redis.on('error', () => {
  if (!hasLoggedConnectionWarning) {
    console.warn('[redis] unavailable - rate limiting and caching will fail open');
    hasLoggedConnectionWarning = true;
  }
});

redis.connect().catch(() => {});
