import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimit,
  resetRateLimitStore,
  getRateLimitStoreSize,
} from "@/lib/rate-limit";

beforeEach(() => {
  resetRateLimitStore();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("rate-limit", () => {
  // ─── Basic rate limiting ─────────────────────────────────────

  it("allows N requests within the limit", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("ip-a", 5, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.retryAfterMs).toBe(0);
    }
  });

  it("rejects the (N+1)-th request", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip-a", 5, 60_000);
    }
    const result = checkRateLimit("ip-a", 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("continues rejecting after exceeding the limit", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip-a", 5, 60_000);
    }
    // Multiple excess requests should all be rejected
    for (let i = 0; i < 3; i++) {
      const result = checkRateLimit("ip-a", 5, 60_000);
      expect(result.allowed).toBe(false);
    }
  });

  // ─── Window expiry ───────────────────────────────────────────

  it("resets counter after window expires", () => {
    // Use 5 requests
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip-a", 5, 60_000);
    }
    // 6th should be rejected
    expect(checkRateLimit("ip-a", 5, 60_000).allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(61_000);

    // Should be allowed again
    const result = checkRateLimit("ip-a", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("starts a new window after expiry", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("ip-a", 5, 60_000);
    }
    vi.advanceTimersByTime(61_000);

    // Fresh window — first call resets counter to 1
    expect(checkRateLimit("ip-a", 5, 60_000).allowed).toBe(true);

    // Fill remaining 4 slots
    for (let i = 0; i < 4; i++) {
      expect(checkRateLimit("ip-a", 5, 60_000).allowed).toBe(true);
    }

    // 6th total since reset (count=6) should be rejected
    expect(checkRateLimit("ip-a", 5, 60_000).allowed).toBe(false);
  });

  // ─── Different limits per IP ─────────────────────────────────

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit("ip-a", 3, 60_000);
    }
    // ip-a exhausted
    expect(checkRateLimit("ip-a", 3, 60_000).allowed).toBe(false);

    // ip-b should be completely independent
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit("ip-b", 3, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit("ip-b", 3, 60_000).allowed).toBe(false);
  });

  it("supports different limits per IP", () => {
    for (let i = 0; i < 2; i++) {
      expect(checkRateLimit("ip-low", 2, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit("ip-low", 2, 60_000).allowed).toBe(false);

    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("ip-high", 10, 60_000).allowed).toBe(true);
    }
    expect(checkRateLimit("ip-high", 10, 60_000).allowed).toBe(false);
  });

  // ─── Cleanup of stale entries ────────────────────────────────

  it("cleans up expired entries on each check", () => {
    // Create entries for 3 different IPs
    checkRateLimit("ip-1", 1, 60_000);
    checkRateLimit("ip-2", 1, 60_000);
    checkRateLimit("ip-3", 1, 60_000);
    expect(getRateLimitStoreSize()).toBe(3);

    // Advance time to expire all
    vi.advanceTimersByTime(61_000);

    // Trigger cleanup by making a new check (new IP)
    checkRateLimit("ip-4", 100, 60_000);

    // Old entries should be cleaned up, only ip-4 remains
    expect(getRateLimitStoreSize()).toBe(1);
  });

  it("cleans up partially expired entries", () => {
    checkRateLimit("ip-old", 1, 60_000);
    vi.advanceTimersByTime(30_000);
    checkRateLimit("ip-new", 1, 60_000);

    // Both exist
    expect(getRateLimitStoreSize()).toBe(2);

    // Advance to expire only ip-old
    vi.advanceTimersByTime(31_000);

    // Check ip-new — triggers cleanup
    checkRateLimit("ip-new", 100, 60_000);

    // ip-old should be gone, ip-new refreshed
    expect(getRateLimitStoreSize()).toBe(1);
  });

  // ─── Edge cases ──────────────────────────────────────────────

  it("rejects all requests when limit is 0", () => {
    const result = checkRateLimit("ip-a", 0, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(60_000);
  });

  it("rejects all requests when limit is negative", () => {
    const result = checkRateLimit("ip-a", -1, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(60_000);
  });

  it("handles burst of requests correctly", () => {
    // Limit of 10, send 15 rapidly
    let allowedCount = 0;
    let rejectedCount = 0;
    for (let i = 0; i < 15; i++) {
      const result = checkRateLimit("ip-burst", 10, 60_000);
      if (result.allowed) allowedCount++;
      else rejectedCount++;
    }
    expect(allowedCount).toBe(10);
    expect(rejectedCount).toBe(5);
  });

  it("retryAfterMs decreases as window approaches expiry", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("ip-timer", 5, 60_000);
    }
    const result1 = checkRateLimit("ip-timer", 5, 60_000);
    expect(result1.allowed).toBe(false);
    const retry1 = result1.retryAfterMs;
    expect(retry1).toBeGreaterThan(0);

    // Advance 10 seconds
    vi.advanceTimersByTime(10_000);

    // Next rejected request should have lower retryAfterMs
    // (but same window is still active)
    const result2 = checkRateLimit("ip-timer", 5, 60_000);
    expect(result2.allowed).toBe(false);
    expect(result2.retryAfterMs).toBeLessThan(retry1);
  });

  it("handles IP with special characters", () => {
    const result = checkRateLimit("192.168.1.1:8080", 5, 60_000);
    expect(result.allowed).toBe(true);
  });

  it("resetRateLimitStore clears all entries", () => {
    checkRateLimit("ip-a", 5, 60_000);
    checkRateLimit("ip-b", 5, 60_000);
    expect(getRateLimitStoreSize()).toBe(2);

    resetRateLimitStore();
    expect(getRateLimitStoreSize()).toBe(0);

    // After reset, should allow fresh requests
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("ip-a", 5, 60_000).allowed).toBe(true);
    }
  });
});