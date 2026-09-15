import type { NextFunction, Request, Response } from 'express';
import { isRedisReady, redis } from '../config/redis';
import { sendError } from '../utils/ApiResponse';

interface RedisRateLimitOptions {
  windowSeconds: number;
  limit: number;
  keyPrefix: string;
  message: string;
}

export function redisRateLimit(options: RedisRateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isRedisReady()) {
      return next();
    }

    const key = `ratelimit:${options.keyPrefix}:${req.ip ?? 'unknown'}`;

    try {
      const pipeline = redis.pipeline();
      pipeline.incr(key);
      pipeline.ttl(key);
      const results = await pipeline.exec();

      if (!results || results[0][0] || results[1][0]) {
        return next();
      }

      const count = results[0][1] as number;
      const ttl = results[1][1] as number;

      if (ttl === -1) {
        await redis.expire(key, options.windowSeconds);
      }

      res.setHeader('RateLimit-Limit', options.limit);
      res.setHeader('RateLimit-Remaining', Math.max(0, options.limit - count));
      res.setHeader('RateLimit-Reset', ttl > 0 ? ttl : options.windowSeconds);

      if (count > options.limit) {
        return sendError(res, { statusCode: 429, message: options.message });
      }
      return next();
    } catch {
      return next();
    }
  };
}
