import { RateLimitError } from './errors';

/**
 * Fixed-window in-memory rate limiter.
 *
 * Scope: a single Node.js process. This satisfies the MVP requirement of
 * throttling credential stuffing / enumeration on a single instance. When the
 * app scales horizontally (multiple pods) this must be swapped for a shared
 * store (Redis/MySQL) - see docs/SECURITY.md "Known limitations".
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

/** Throws RateLimitError when the bucket is exhausted. */
export function enforceRateLimit(key: string, limit: number, windowSeconds: number): void {
  const result = checkRateLimit(key, limit, windowSeconds);
  if (!result.allowed) {
    throw new RateLimitError(
      `Too many attempts. Please retry in ${result.retryAfterSeconds} seconds.`,
      result.retryAfterSeconds,
    );
  }
}

/** Test helper: clears all buckets. */
export function resetRateLimits(): void {
  windows.clear();
  lastSweep = 0;
}
