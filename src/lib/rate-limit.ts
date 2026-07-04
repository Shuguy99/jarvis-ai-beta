/**
 * In-memory sliding-window rate limiter
 *
 * No external dependencies. Stores per-IP counters in a Map.
 * Stale entries are cleaned up on each check.
 *
 * Usage:
 *   import { checkRateLimit } from "@/lib/rate-limit";
 *   const { allowed, retryAfterMs } = checkRateLimit(ip, 30, 60_000);
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─── Store ────────────────────────────────────────────────────────

const store = new Map<string, RateLimitEntry>();

// ─── Cleanup helper ───────────────────────────────────────────────

function cleanup(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Check whether a request from `ip` is within the rate limit.
 *
 * @param ip      Identifier (usually the client IP)
 * @param limit   Max number of requests allowed in the window
 * @param windowMs Length of the window in milliseconds
 * @returns `{ allowed, retryAfterMs }`
 */
export function checkRateLimit(
  ip: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();

  // Edge case: limit of 0 means nothing is allowed
  if (limit <= 0) {
    return { allowed: false, retryAfterMs: windowMs };
  }

  // Delete all expired entries first (keeps the Map from growing forever)
  cleanup();

  const entry = store.get(ip);

  // No entry or window expired → fresh counter
  if (!entry || now >= entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  // Within window — increment and check
  entry.count += 1;

  if (entry.count > limit) {
    const retryAfterMs = entry.resetAt - now;
    return { allowed: false, retryAfterMs };
  }

  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Reset the rate-limit store (useful for tests).
 */
export function resetRateLimitStore(): void {
  store.clear();
}

/**
 * Get the size of the rate-limit store (useful for tests / diagnostics).
 */
export function getRateLimitStoreSize(): number {
  return store.size;
}