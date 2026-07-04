import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFetch = vi.fn();

describe("ai-provider (unit, no server calls)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
  });

  it("getProviderName returns Ollama", async () => {
    const { ai } = await import("@/lib/ai-provider");
    expect(ai.getProviderName()).toContain("Ollama");
  });

  it("isChatAvailable returns true", async () => {
    const { ai } = await import("@/lib/ai-provider");
    expect(ai.isChatAvailable()).toBe(true);
  });

  it("chat calls fetch and returns content", async () => {
    // First call: getProviderSettings → returns empty settings (falls back to ollama)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("not found"),
    });
    // Second call: ollamaFetch → chat completions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ choices: [{ message: { content: "Hello" } }] }),
    });

    const { ai } = await import("@/lib/ai-provider");
    const result = await ai.chat([{ role: "user", content: "Hi" }]);

    expect(result.content).toBe("Hello");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // The second call (ollamaFetch) should have JSON body with stream: false
    const chatBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(chatBody.stream).toBe(false);
  });

  it("chatStream yields chunks", async () => {
    // getProviderSettings fallback
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("not found"),
    });

    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hi"}}]}',
      'data: {"choices":[{"delta":{"content":" world"}}]}',
      "data: [DONE]",
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of chunks) {
          await controller.enqueue(encoder.encode(chunk + "\n\n"));
        }
        controller.close();
      },
    });

    mockFetch.mockResolvedValueOnce({ ok: true, body: stream });

    const { ai } = await import("@/lib/ai-provider");
    const gen = ai.chatStream([{ role: "user", content: "Hi" }]);

    const results: string[] = [];
    for await (const chunk of gen) {
      results.push(chunk);
    }

    expect(results).toEqual(["Hi", " world"]);
  });

  it("throws on connection error", async () => {
    // getProviderSettings fallback
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("not found"),
    });
    // ollamaFetch throws
    mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));

    const { ai } = await import("@/lib/ai-provider");
    await expect(
      ai.chat([{ role: "user", content: "Hi" }]),
    ).rejects.toThrow();
  });
});