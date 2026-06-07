import { getRedis } from "@/lib/redis";

// Fallback in-memory buckets when Redis is not configured.
const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window rate limiter.
 * Uses Redis (ioredis) when REDIS_URL is set, otherwise falls back to
 * in-memory Map. Returns `true` if the request is allowed.
 */
export async function rateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    const redisKey = `rate_limit:${key}`;
    const current = await redis.incr(redisKey);
    if (current === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    return current <= limit;
  }

  const now = Date.now();
  const entry = memoryBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
