/**
 * Timeout wrapper for async operations.
 *
 * Uses Promise.race with a timeout to reject after `ms` milliseconds.
 *
 * Usage:
 *   import { withTimeout } from "@/lib/api-timeout";
 *   const result = await withTimeout(fetch(url), 30_000, "Request timed out");
 */

// ─── Default timeouts (milliseconds) ─────────────────────────────

export const DEFAULT_TIMEOUT_MS = 30_000;   // 30 s — general API calls
export const AI_CHAT_TIMEOUT_MS = 120_000;   // 120 s — chat completions
export const AI_OTHER_TIMEOUT_MS = 60_000;   // 60 s — vision, image-gen, etc.

// ─── Custom error ─────────────────────────────────────────────────

export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  constructor(timeoutMs: number, message?: string) {
    super(message ?? `Request timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

// ─── Public API ───────────────────────────────────────────────────

/**
 * Wraps any promise with a timeout.
 *
 * If the inner promise settles before `ms`, its result is returned.
 * If `ms` elapses first, a `TimeoutError` is thrown.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  let rejected = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      rejected = true;
      reject(new TimeoutError(ms, message));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Create a fetch call with a built-in timeout signal.
 * Uses AbortController to abort the fetch after `ms` milliseconds.
 *
 * @param url   The URL to fetch
 * @param init  Standard fetch init, plus optional `timeoutMs`
 * @param defaultTimeout  Fallback timeout if not specified in init
 */
export function fetchWithTimeout(
  url: string | URL | Request,
  init?: RequestInit & { timeoutMs?: number },
  defaultTimeout: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const ms = init?.timeoutMs ?? defaultTimeout;
  const { timeoutMs: _t, ...rest } = init ?? {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  const signal = rest.signal
    ? AbortSignal.any([rest.signal, controller.signal])
    : controller.signal;

  return fetch(url, { ...rest, signal }).finally(() => clearTimeout(timer));
}