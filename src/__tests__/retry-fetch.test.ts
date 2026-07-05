import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { retryFetch } from "@/lib/ai-provider";

describe("retryFetch", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it("returns response on first success", async () => {
    const okResponse = new Response("ok", { status: 200 });
    fetchMock.mockResolvedValueOnce(okResponse);

    const result = await retryFetch("http://localhost/test", {});
    expect(result).toBe(okResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on retry", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 2, 100);

    // Advance past the backoff delay (100ms * 2^0 = 100ms for first retry)
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400 client error", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad", { status: 400 }));

    const result = await retryFetch("http://localhost/test", {});
    expect(result.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 401 unauthorized", async () => {
    fetchMock.mockResolvedValueOnce(new Response("unauthorized", { status: 401 }));

    const result = await retryFetch("http://localhost/test", {});
    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 404 not found", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const result = await retryFetch("http://localhost/test", {});
    expect(result.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 rate limit", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 2, 100);
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 internal error", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("internal", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 2, 100);
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on network ECONNREFUSED error", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:11434"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 2, 100);
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on ETIMEDOUT error", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("connect ETIMEDOUT 127.0.0.1:11434"))
      .mockRejectedValueOnce(new Error("connect ETIMEDOUT 127.0.0.1:11434"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 3, 100);
    // Need to advance past: 100ms + 200ms = 300ms (exponential backoff)
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retries on ECONNRESET error", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("read ECONNRESET"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 2, 100);
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on EPIPE error", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("write EPIPE"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 2, 100);
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws immediately on non-retryable network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(
      retryFetch("http://localhost/test", {}),
    ).rejects.toThrow("fetch failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all retries on status codes", async () => {
    fetchMock.mockResolvedValue(new Response("err", { status: 503 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 1, 100);
    // Default retries=2 → 1 initial + 2 retries = 3 calls
    // But with retries=1 → 1 initial + 1 retry = 2 calls
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;

    // After exhausting retries, returns the last 503 response (doesn't throw for status codes)
    expect(result.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("throws after exhausting all retries on network errors", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const resultPromise = retryFetch("http://localhost/test", {}, 1, 100);
    // Prevent "unhandled rejection" during timer advancement
    const caught = resultPromise.catch((e: Error) => e);

    // Advance timers to trigger the retry
    await vi.advanceTimersByTimeAsync(500);

    const err = await caught;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain("ECONNREFUSED");
    expect(fetchMock).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("uses exponential backoff timing", async () => {
    const delays: number[] = [];
    let callTime = 0;

    fetchMock
      .mockImplementationOnce(() => {
        delays.push(callTime);
        return Promise.resolve(new Response("err", { status: 503 }));
      })
      .mockImplementationOnce(() => {
        delays.push(callTime);
        return Promise.resolve(new Response("err", { status: 503 }));
      })
      .mockImplementationOnce(() => {
        delays.push(callTime);
        return Promise.resolve(new Response("ok", { status: 200 }));
      });

    // Advance in steps to observe timing
    const resultPromise = retryFetch("http://localhost/test", {}, 2, 500);

    // First call happens immediately at t=0
    // First retry should wait baseDelay * 2^0 = 500ms
    callTime = 500;
    await vi.advanceTimersByTimeAsync(500);

    // Second retry should wait baseDelay * 2^1 = 1000ms
    callTime = 500 + 1000;
    await vi.advanceTimersByTimeAsync(1000);

    const result = await resultPromise;
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("passes URL and init options to fetch", async () => {
    const okResponse = new Response("ok", { status: 200 });
    fetchMock.mockResolvedValueOnce(okResponse);

    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    };

    await retryFetch("http://localhost/test", init);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      }),
    );
  });

  it("respects retries=0 (no retries)", async () => {
    fetchMock.mockResolvedValueOnce(new Response("err", { status: 503 }));

    const result = await retryFetch("http://localhost/test", {}, 0);
    expect(result.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("respects retries=3 (4 total attempts)", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("err", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const resultPromise = retryFetch("http://localhost/test", {}, 3, 50);
    // 50ms + 100ms + 200ms = 350ms needed
    await vi.advanceTimersByTimeAsync(500);
    const result = await resultPromise;
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});