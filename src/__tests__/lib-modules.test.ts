import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  contextBus,
  correlateEvents,
  publishSystemMetrics,
  publishChatMessage,
  publishWeatherUpdate,
  publishProactiveAlert,
} from "@/lib/context-bus";
import { enforceBodyLimit, BodyLimitError, parseJsonBody, MAX_BODY_BYTES_CHAT, MAX_BODY_BYTES_VISION, MAX_BODY_BYTES_DEFAULT } from "@/lib/body-limit";
import { cn } from "@/lib/utils";

// ── context-bus ──────────────────────────────────────────────

describe("context-bus", () => {
  beforeEach(() => {
    contextBus.clear();
  });

  describe("publish / on", () => {
    it("delivers event to typed listener", () => {
      const received: unknown[] = [];
      const unsub = contextBus.on("system:cpu-high", (e) => received.push(e));
      contextBus.publish({
        type: "system:cpu-high",
        data: { cpuLoad: 95, topProcess: "chrome", topProcessCpu: 40 },
        timestamp: 1000,
      });
      expect(received).toHaveLength(1);
      expect((received[0] as { data: { cpuLoad: number } }).data.cpuLoad).toBe(95);
      unsub();
    });

    it("delivers event to wildcard listener", () => {
      const received: unknown[] = [];
      const unsub = contextBus.onAny((e) => received.push(e));
      contextBus.publish({
        type: "chat:message-sent",
        data: { messageId: "m1", content: "hi" },
        timestamp: 1,
      });
      expect(received).toHaveLength(1);
      expect((received[0] as { type: string }).type).toBe("chat:message-sent");
      unsub();
    });

    it("does not deliver after unsubscribe", () => {
      const received: unknown[] = [];
      const unsub = contextBus.on("weather:updated", (e) => received.push(e));
      unsub();
      contextBus.publish({
        type: "weather:updated",
        data: { temp: 20, condition: "sunny", humidity: 50, windSpeed: 5, location: "Moscow" },
        timestamp: 1,
      });
      expect(received).toHaveLength(0);
    });

    it("supports multiple listeners on same type", () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      const unsubA = contextBus.on("system:metrics", (e) => a.push(e));
      const unsubB = contextBus.on("system:metrics", (e) => b.push(e));
      contextBus.publish({
        type: "system:metrics",
        data: { cpuLoad: 50, memPct: 60, diskPct: 40, temp: 45, netSpeedIn: 10, netSpeedOut: 5 },
        timestamp: 1,
      });
      expect(a).toHaveLength(1);
      expect(b).toHaveLength(1);
      unsubA();
      unsubB();
    });
  });

  describe("once", () => {
    it("fires only once", () => {
      const count = { n: 0 };
      contextBus.once("process:killed", () => { count.n++; });
      contextBus.publish({ type: "process:killed", data: { pid: 1, name: "a" }, timestamp: 1 });
      contextBus.publish({ type: "process:killed", data: { pid: 2, name: "b" }, timestamp: 2 });
      expect(count.n).toBe(1);
    });
  });

  describe("getHistory / getRecentEvents", () => {
    it("stores events in history", () => {
      contextBus.publish({ type: "system:metrics", data: { cpuLoad: 1, memPct: 2, diskPct: 3, temp: 4, netSpeedIn: 5, netSpeedOut: 6 }, timestamp: 1 });
      contextBus.publish({ type: "system:metrics", data: { cpuLoad: 7, memPct: 8, diskPct: 9, temp: 10, netSpeedIn: 11, netSpeedOut: 12 }, timestamp: 2 });
      expect(contextBus.getHistory()).toHaveLength(2);
    });

    it("filters by type", () => {
      contextBus.publish({ type: "system:metrics", data: { cpuLoad: 1, memPct: 2, diskPct: 3, temp: 4, netSpeedIn: 5, netSpeedOut: 6 }, timestamp: 1 });
      contextBus.publish({ type: "chat:message-sent", data: { messageId: "m1", content: "hi" }, timestamp: 2 });
      contextBus.publish({ type: "system:cpu-high", data: { cpuLoad: 99, topProcess: "x", topProcessCpu: 50 }, timestamp: 3 });
      expect(contextBus.getHistory("system:metrics")).toHaveLength(1);
      expect(contextBus.getHistory("system:")).toHaveLength(2); // prefix match
    });

    it("respects limit", () => {
      for (let i = 0; i < 10; i++) {
        contextBus.publish({ type: "system:metrics", data: { cpuLoad: i, memPct: i, diskPct: i, temp: i, netSpeedIn: i, netSpeedOut: i }, timestamp: i });
      }
      expect(contextBus.getRecentEvents(3)).toHaveLength(3);
      expect(contextBus.getRecentEvents(3)[0].timestamp).toBe(7); // oldest of last 3
    });

    it("clear resets everything", () => {
      contextBus.publish({ type: "system:metrics", data: { cpuLoad: 1, memPct: 2, diskPct: 3, temp: 4, netSpeedIn: 5, netSpeedOut: 6 }, timestamp: 1 });
      contextBus.clear();
      expect(contextBus.getHistory()).toHaveLength(0);
      expect(contextBus.getListenerCount()).toBe(0);
    });
  });

  describe("getListenerCount", () => {
    it("counts per-type and total", () => {
      const unsub1 = contextBus.on("system:metrics", () => {});
      const unsub2 = contextBus.on("system:metrics", () => {});
      const unsub3 = contextBus.on("chat:message-sent", () => {});
      expect(contextBus.getListenerCount("system:metrics")).toBe(2);
      expect(contextBus.getListenerCount("chat:message-sent")).toBe(1);
      expect(contextBus.getListenerCount()).toBe(3);
      unsub1();
      unsub2();
      unsub3();
    });
  });

  describe("error isolation", () => {
    it("swallows listener errors", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      contextBus.on("system:metrics", () => { throw new Error("boom"); });
      // Should not throw
      contextBus.publish({ type: "system:metrics", data: { cpuLoad: 1, memPct: 2, diskPct: 3, temp: 4, netSpeedIn: 5, netSpeedOut: 6 }, timestamp: 1 });
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe("correlateEvents", () => {
    it("returns all events for empty query", () => {
      contextBus.publish({ type: "system:metrics", data: { cpuLoad: 1, memPct: 2, diskPct: 3, temp: 4, netSpeedIn: 5, netSpeedOut: 6 }, timestamp: 1 });
      const result = correlateEvents("");
      expect(result).toHaveLength(1);
    });

    it("filters by keyword relevance", () => {
      contextBus.publish({ type: "weather:updated", data: { temp: 30, condition: "sunny", humidity: 50, windSpeed: 10, location: "Moscow" }, timestamp: 1 });
      contextBus.publish({ type: "chat:message-sent", data: { messageId: "m1", content: "hello world" }, timestamp: 2 });
      const result = correlateEvents("weather Moscow");
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("weather:updated");
    });
  });

  describe("convenience publishers", () => {
    it("publishSystemMetrics emits correct type", () => {
      const received: unknown[] = [];
      contextBus.on("system:metrics", (e) => received.push(e));
      publishSystemMetrics({ cpuLoad: 50, memPct: 60, diskPct: 70, temp: 80, netSpeedIn: 1, netSpeedOut: 2 });
      expect(received).toHaveLength(1);
    });

    it("publishChatMessage emits user or assistant event", () => {
      const sent: unknown[] = [];
      const received: unknown[] = [];
      contextBus.on("chat:message-sent", (e) => sent.push(e));
      contextBus.on("chat:message-received", (e) => received.push(e));

      publishChatMessage({ messageId: "m1", content: "hi", isUser: true });
      publishChatMessage({ messageId: "m2", content: "hello", isUser: false });

      expect(sent).toHaveLength(1);
      expect(received).toHaveLength(1);
    });

    it("publishProactiveAlert emits correct event", () => {
      const received: unknown[] = [];
      contextBus.on("jarvis:proactive-alert", (e) => received.push(e));
      publishProactiveAlert({ message: "CPU high", severity: "warning" });
      expect(received).toHaveLength(1);
    });
  });
});

// ── body-limit ────────────────────────────────────────────────

describe("body-limit", () => {
  it("constants have expected values", () => {
    expect(MAX_BODY_BYTES_CHAT).toBe(512 * 1024);
    expect(MAX_BODY_BYTES_VISION).toBe(20 * 1024 * 1024);
    expect(MAX_BODY_BYTES_DEFAULT).toBe(1024 * 1024);
  });

  it("BodyLimitError has correct shape", () => {
    const err = new BodyLimitError(1024);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("BodyLimitError");
    expect(err.maxBytes).toBe(1024);
    expect(err.message).toContain("MB");
  });

  it("enforceBodyLimit passes for small body", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "hello",
      headers: { "content-length": "5" },
    });
    const result = await enforceBodyLimit(req, 1024);
    expect(result).toBe("hello");
  });

  it("enforceBodyLimit throws on content-length overflow", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "x".repeat(2000),
      headers: { "content-length": "2000" },
    });
    await expect(enforceBodyLimit(req, 1024)).rejects.toThrow(BodyLimitError);
  });

  it("enforceBodyLimit throws on actual body overflow (spoofed header)", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: "x".repeat(2000),
      headers: { "content-length": "10" }, // lie
    });
    await expect(enforceBodyLimit(req, 1024)).rejects.toThrow(BodyLimitError);
  });

  it("parseJsonBody parses valid JSON", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ key: "value" }),
      headers: { "content-length": "16" },
    });
    const result = await parseJsonBody<{ key: string }>(req, 1024);
    expect(result.key).toBe("value");
  });
});

// ── utils ────────────────────────────────────────────────────

describe("utils / cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("tailwind-merges conflicting classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});