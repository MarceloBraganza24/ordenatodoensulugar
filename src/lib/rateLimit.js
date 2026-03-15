// /lib/rateLimit.js
const buckets = new Map();

/**
 * Simple in-memory rate limiter (works best on single instance).
 * key: string
 * limit: number
 * windowMs: number
 */
export function hitLimit(key, limit, windowMs) {
  const now = Date.now();
  const cur = buckets.get(key);

  if (!cur || now - cur.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }

  cur.count += 1;
  const allowed = cur.count <= limit;
  return { allowed, remaining: Math.max(0, limit - cur.count) };
}