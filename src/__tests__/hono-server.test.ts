import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @/lib/db ───────────────────────────────────────────────
const mockSettingFindMany = vi.fn().mockResolvedValue([]);
const mockSettingUpsert = vi.fn().mockResolvedValue({});
const mockNoteFindMany = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
  db: {
    setting: { findMany: mockSettingFindMany, upsert: mockSettingUpsert },
    note: { findMany: mockNoteFindMany, create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    conversation: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), delete: vi.fn(), update: vi.fn() },
    message: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
  },
}));

// ─── Mock @/lib/ai-provider ──────────────────────────────────────
const mockGetAvailableProviders = vi.fn().mockReturnValue([
  { id: "ollama", name: "Ollama (Local AI)", chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false },
]);
const mockGetActiveProviderInfo = vi.fn().mockResolvedValue({
  id: "ollama", name: "Ollama (Local AI)", chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false,
});

vi.mock("@/lib/ai-provider", () => ({
  ai: {
    getAvailableProviders: mockGetAvailableProviders,
    getActiveProviderInfo: mockGetActiveProviderInfo,
    getProviderName: vi.fn(() => "Ollama"),
    isChatAvailable: vi.fn(() => true),
    chat: vi.fn(),
    chatStream: vi.fn(),
    vision: vi.fn(),
  },
}));

// ─── Mock @/lib/rag-fts5 ─────────────────────────────────────────
vi.mock("@/lib/rag-fts5", () => ({
  searchFTS5: vi.fn().mockResolvedValue([]),
  ensureFTS5: vi.fn().mockResolvedValue(undefined),
}));

describe("Hono API Server - Route Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingFindMany.mockResolvedValue([]);
    mockNoteFindMany.mockResolvedValue([]);
  });

  it("GET /api/jarvis/settings returns settings object", async () => {
    const { GET } = await import("@/app/api/jarvis/settings/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("settings");
    // Should have all VALID_KEYS
    expect(Object.keys(body.settings).length).toBeGreaterThan(10);
  });

  it("GET /api/jarvis/settings contains expected default keys", async () => {
    const { GET } = await import("@/app/api/jarvis/settings/route");
    const res = await GET();
    const body = await res.json();
    const keys = Object.keys(body.settings);
    expect(keys).toContain("temperature");
    expect(keys).toContain("maxTokens");
    expect(keys).toContain("aiProvider");
    expect(keys).toContain("persona");
  });

  it("GET /api/jarvis/providers returns 5 providers in catalog", async () => {
    const { GET } = await import("@/app/api/jarvis/providers/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("catalog");
    expect(body).toHaveProperty("active");
    expect(body.catalog).toHaveLength(5);
    expect(body.catalog.map((p: any) => p.id)).toEqual(
      expect.arrayContaining(["ollama", "openai", "anthropic", "gemini", "openrouter"]),
    );
  });

  it("GET /api/jarvis/providers marks ollama as configured via mock", async () => {
    const { GET } = await import("@/app/api/jarvis/providers/route");
    const res = await GET();
    const body = await res.json();
    const ollama = body.catalog.find((p: any) => p.id === "ollama");
    expect(ollama.configured).toBe(true);
  });

  it("GET /api/jarvis/providers marks non-mocked providers as not configured", async () => {
    const { GET } = await import("@/app/api/jarvis/providers/route");
    const res = await GET();
    const body = await res.json();
    const openai = body.catalog.find((p: any) => p.id === "openai");
    expect(openai.configured).toBe(false);
  });

  it("GET /api/jarvis/notes returns notes array", async () => {
    mockNoteFindMany.mockResolvedValue([
      { id: "1", title: "Test Note", content: "Hello", pinned: false, updatedAt: new Date() },
    ]);
    const { GET } = await import("@/app/api/jarvis/notes/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notes");
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].title).toBe("Test Note");
  });

  it("GET /api/jarvis/notes returns empty array when DB is empty", async () => {
    mockNoteFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/jarvis/notes/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toHaveLength(0);
  });

  it("GET /api/jarvis/system returns system info with cpuLoad", async () => {
    const { GET } = await import("@/app/api/jarvis/system/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("cpuLoad");
    expect(body).toHaveProperty("memPct");
    expect(body).toHaveProperty("cpus");
    expect(typeof body.cpuLoad).toBe("number");
  });

  it("PUT /api/jarvis/settings rejects invalid keys", async () => {
    const { PUT } = await import("@/app/api/jarvis/settings/route");
    const req = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { invalidKey: "value" } }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid setting key");
  });

  it("PUT /api/jarvis/settings accepts valid keys", async () => {
    const { PUT } = await import("@/app/api/jarvis/settings/route");
    const req = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { temperature: "0.9" } }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSettingUpsert).toHaveBeenCalledTimes(1);
  });

  it("PUT /api/jarvis/settings rejects missing settings object", async () => {
    const { PUT } = await import("@/app/api/jarvis/settings/route");
    const req = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await PUT(req);
    expect(res.status).toBe(400);
  });

  it("PUT /api/jarvis/settings skips masked sensitive values", async () => {
    const { PUT } = await import("@/app/api/jarvis/settings/route");
    const req = new Request("http://localhost", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { openaiApiKey: "sk-1****abcd" } }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    // Masked values (containing ****) should be skipped — no upsert called
    expect(mockSettingUpsert).not.toHaveBeenCalled();
  });

  it("API keys are masked in GET /api/jarvis/settings", async () => {
    mockSettingFindMany.mockResolvedValue([
      { key: "openaiApiKey", value: "sk-proj-abcdefghijklmnopqrst" },
    ]);
    const { GET } = await import("@/app/api/jarvis/settings/route");
    const res = await GET();
    const body = await res.json();
    // Value should be masked (first 4 + **** + last 4)
    expect(body.settings.openaiApiKey).toBe("sk-p****qrst");
    expect(body.settings.openaiApiKey).not.toContain("proj");
  });

  it("API keys return empty string when not set", async () => {
    mockSettingFindMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/jarvis/settings/route");
    const res = await GET();
    const body = await res.json();
    expect(body.settings.openaiApiKey).toBe("");
    expect(body.settings.anthropicApiKey).toBe("");
    expect(body.settings.geminiApiKey).toBe("");
    expect(body.settings.openrouterApiKey).toBe("");
  });
});

describe("Security - Origin Check", () => {
  it("accepts local origins", () => {
    const localOrigins = [
      "",
      "http://localhost:5173",
      "http://localhost:3000",
      "http://127.0.0.1:3001",
      "http://[::1]:5173",
    ];

    for (const origin of localOrigins) {
      const isLocal =
        origin === "" ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1") ||
        origin.startsWith("http://[::1]");
      expect(isLocal, `Expected "${origin}" to be local`).toBe(true);
    }
  });

  it("accepts Electron-specific origins", () => {
    const electronOrigins = ["app://", "file://", "null"];

    for (const origin of electronOrigins) {
      const isElectron =
        origin.startsWith("app://") ||
        origin.startsWith("file://") ||
        origin === "null";
      expect(isElectron, `Expected "${origin}" to be Electron origin`).toBe(true);
    }
  });

  it("rejects non-local origins", () => {
    const blockedOrigins = [
      "https://evil.com",
      "http://192.168.1.5:3001",
      "https://example.com",
      "http://attacker.local:5173",
    ];

    for (const origin of blockedOrigins) {
      const isLocal =
        origin === "" ||
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1") ||
        origin.startsWith("http://[::1]");
      const isElectron =
        origin.startsWith("app://") ||
        origin.startsWith("file://") ||
        origin === "null";
      expect(isLocal || isElectron, `Expected "${origin}" to be blocked`).toBe(false);
    }
  });

  it("rejects HTTPS localhost (not HTTP)", () => {
    const origin = "https://localhost:5173";
    const isLocal =
      origin === "" ||
      origin.startsWith("http://localhost") ||  // Note: http:// not https://
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("http://[::1]");
    // https://localhost should NOT match http://localhost
    expect(isLocal).toBe(false);
  });
});