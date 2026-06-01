// Tiny in-memory, per-key fixed-window rate limiter shared by the public
// capture endpoints (forms, booking, funnels). Process-local — good enough to
// blunt casual spam on a single instance; swap for a shared store if scaled out.

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count += 1;
  return true;
}
