import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { HttpError } from './errors.js';

export interface Limit {
  name: string;
  limit: number;
  windowMs: number;
}

/**
 * Sliding-window rate limit backed by a Redis sorted set.
 * Throws 429 (with retry_after seconds) once `key` exceeds `limit` hits within the window.
 */
export async function enforceRateLimit(redis: Redis, rule: Limit, key: string): Promise<void> {
  const redisKey = `ratelimit:${rule.name}:${key}`;
  const now = Date.now();
  const results = await redis
    .multi()
    .zremrangebyscore(redisKey, 0, now - rule.windowMs)
    .zadd(redisKey, now, `${now}:${randomUUID()}`)
    .zcard(redisKey)
    .zrange(redisKey, '0', '0', 'WITHSCORES')
    .pexpire(redisKey, rule.windowMs)
    .exec();

  const count = Number(results?.[2]?.[1] ?? 0);
  if (count > rule.limit) {
    const oldest = Number((results?.[3]?.[1] as string[] | undefined)?.[1] ?? now);
    const retryAfter = Math.max(1, Math.ceil((oldest + rule.windowMs - now) / 1000));
    throw new HttpError(429, 'rate_limited', { retry_after: retryAfter });
  }
}
