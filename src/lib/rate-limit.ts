/**
 * Lightweight in-memory rate limiter.
 *
 * Works well on serverless (Vercel) where each cold start resets state.
 * For distributed rate limiting across multiple instances, swap with
 * @upstash/ratelimit + @upstash/redis (same API shape).
 *
 * Usage:
 *   const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
 *   const { success, remaining } = limiter.check(ip);
 */

type RateLimitEntry = { count: number; resetAt: number };

export function createRateLimiter(opts: {
  /** Max requests allowed per window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}) {
  const { limit, windowMs } = opts;
  const store = new Map<string, RateLimitEntry>();

  // Periodic cleanup to prevent memory leaks in long-lived processes
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, windowMs * 2).unref?.();

  return {
    check(key: string): { success: boolean; limit: number; remaining: number; resetAt: number } {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(key, entry);
      }

      entry.count++;

      const remaining = Math.max(0, limit - entry.count);
      const success = entry.count <= limit;

      return { success, limit, remaining, resetAt: entry.resetAt };
    },
  };
}

/** Shared rate limiter: 20 requests per minute per IP. */
export const apiRateLimiter = createRateLimiter({
  limit: 20,
  windowMs: 60_000,
});

/** Extract client IP from request headers. */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
