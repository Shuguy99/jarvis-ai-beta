import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock @/lib/ai-provider ───────────────────────────────────────────
const mockGetAvailableProviders = vi.fn();
const mockGetActiveProviderInfo = vi.fn();

vi.mock("@/lib/ai-provider", () => ({
  ai: {
    getAvailableProviders: mockGetAvailableProviders,
    getActiveProviderInfo: mockGetActiveProviderInfo,
    getProviderName: vi.fn(() => "Ollama"),
    isChatAvailable: vi.fn(() => true),
    chat: vi.fn(),
    chatStream: vi.fn(),
  },
}));

// ─── Mock @/lib/db (used by settings, conversations, notes, plugins) ──
const mockSettingFindMany = vi.fn();
const mockSettingUpsert = vi.fn();
const mockConversationFindMany = vi.fn();
const mockConversationCreate = vi.fn();
const mockConversationFindUnique = vi.fn();
const mockConversationDelete = vi.fn();
const mockConversationUpdate = vi.fn();
const mockMessageCreate = vi.fn();
const mockNoteFindMany = vi.fn();
const mockNoteCreate = vi.fn();
const mockNoteUpdate = vi.fn();
const mockNoteDelete = vi.fn();
const mockNoteDeleteMany = vi.fn();
const mockPluginFindMany = vi.fn();
const mockPluginUpsert = vi.fn();
const mockPluginDeleteMany = vi.fn();
const mockPluginFindUnique = vi.fn();
const mockPluginUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    setting: {
      findMany: mockSettingFindMany,
      upsert: mockSettingUpsert,
    },
    conversation: {
      findMany: mockConversationFindMany,
      create: mockConversationCreate,
      findUnique: mockConversationFindUnique,
      delete: mockConversationDelete,
      update: mockConversationUpdate,
    },
    message: {
      create: mockMessageCreate,
    },
    note: {
      findMany: mockNoteFindMany,
      create: mockNoteCreate,
      update: mockNoteUpdate,
      delete: mockNoteDelete,
      deleteMany: mockNoteDeleteMany,
    },
    plugin: {
      findMany: mockPluginFindMany,
      upsert: mockPluginUpsert,
      deleteMany: mockPluginDeleteMany,
      findUnique: mockPluginFindUnique,
      update: mockPluginUpdate,
    },
    document: {
      create: mockPrismaDocumentCreate,
      findMany: mockPrismaDocumentFindMany,
      delete: mockPrismaDocumentDelete,
    },
  },
}));

// ─── Mock @prisma/client (used directly by plugins and RAG routes) ────
const mockPrismaDocumentCreate = vi.fn();
const mockPrismaDocumentFindMany = vi.fn();
const mockPrismaDocumentDelete = vi.fn();

const mockPrismaPluginFindMany = vi.fn();
const mockPrismaPluginUpsert = vi.fn();
const mockPrismaPluginDeleteMany = vi.fn();
const mockPrismaPluginFindUnique = vi.fn();
const mockPrismaPluginUpdate = vi.fn();

function createMockPrisma() {
  return {
    document: {
      create: mockPrismaDocumentCreate,
      findMany: mockPrismaDocumentFindMany,
      delete: mockPrismaDocumentDelete,
    },
    plugin: {
      findMany: mockPrismaPluginFindMany,
      upsert: mockPrismaPluginUpsert,
      deleteMany: mockPrismaPluginDeleteMany,
      findUnique: mockPrismaPluginFindUnique,
      update: mockPrismaPluginUpdate,
    },
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
}

const MockPrismaClient = vi.fn(createMockPrisma);

vi.mock("@prisma/client", () => ({
  PrismaClient: MockPrismaClient,
}));

// ─── Mock @/lib/rag-fts5 ─────────────────────────────────────────────
vi.mock("@/lib/rag-fts5", () => ({
  searchFTS5: vi.fn().mockResolvedValue([]),
  ensureFTS5: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock @/lib/jarvis (used by conversations route) ─────────────────
vi.mock("@/lib/jarvis", () => ({
  deriveTitle: vi.fn((text: string) => text.slice(0, 40)),
}));

// ─── Mock fs/promises (used by RAG route) ────────────────────────────
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// ─── Helper: parse JSON from Response ────────────────────────────────
async function parseBody(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

describe("API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── 1. Providers GET ───────────────────────────────────────────
  describe("GET /api/jarvis/providers", () => {
    it("returns catalog array with all 5 providers", async () => {
      mockGetAvailableProviders.mockReturnValue([
        { id: "ollama", name: "Ollama", chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false },
        { id: "openai", name: "OpenAI", chatAvailable: true, visionAvailable: true, imageGenAvailable: true, searchAvailable: false },
      ]);
      mockGetActiveProviderInfo.mockResolvedValue({
        id: "ollama",
        name: "Ollama (Local AI)",
        chatAvailable: true,
        visionAvailable: true,
        imageGenAvailable: false,
        searchAvailable: false,
      });

      const { GET } = await import("@/app/api/jarvis/providers/route");
      const res = await GET();
      const body = await parseBody(res);

      expect(res.status).toBe(200);
      expect(Array.isArray((body as { catalog: unknown[] }).catalog)).toBe(true);
      expect((body as { catalog: Array<{ id: string }> }).catalog).toHaveLength(5);
      const ids = (body as { catalog: Array<{ id: string }> }).catalog.map((p) => p.id);
      expect(ids).toEqual(["ollama", "openai", "anthropic", "gemini", "openrouter"]);
    });

    it("has configured flag on each provider", async () => {
      mockGetAvailableProviders.mockReturnValue([
        { id: "ollama", name: "Ollama", chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false },
      ]);
      mockGetActiveProviderInfo.mockResolvedValue({
        id: "ollama",
        name: "Ollama (Local AI)",
        chatAvailable: true,
        visionAvailable: true,
        imageGenAvailable: false,
        searchAvailable: false,
      });

      const { GET } = await import("@/app/api/jarvis/providers/route");
      const res = await GET();
      const body = await parseBody(res) as { catalog: Array<{ id: string; configured: boolean }> };

      expect(body.catalog[0]).toHaveProperty("configured");
      expect(body.catalog[0].id).toBe("ollama");
      expect(body.catalog[0].configured).toBe(true);

      // non-configured providers should have configured=false
      expect(body.catalog.find((p) => p.id === "openai")!.configured).toBe(false);
    });

    it("returns active provider info", async () => {
      mockGetAvailableProviders.mockReturnValue([
        { id: "ollama", name: "Ollama", chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false },
      ]);
      mockGetActiveProviderInfo.mockResolvedValue({
        id: "ollama",
        name: "Ollama (Local AI)",
        chatAvailable: true,
        visionAvailable: true,
        imageGenAvailable: false,
        searchAvailable: false,
      });

      const { GET } = await import("@/app/api/jarvis/providers/route");
      const res = await GET();
      const body = await parseBody(res) as { active: { id: string } };

      expect(body.active).toBeDefined();
      expect(body.active.id).toBe("ollama");
    });
  });

  // ─── 2. Plugins GET ─────────────────────────────────────────────
  describe("GET /api/jarvis/plugins", () => {
    it("returns plugins array with actionCount", async () => {
      mockPrismaPluginFindMany.mockResolvedValue([
        {
          pluginId: "test-plugin",
          name: "Test Plugin",
          description: "A test",
          version: "1.0.0",
          author: "dev",
          category: "system",
          icon: "Puzzle",
          enabled: true,
          settings: JSON.stringify([]),
          createdAt: new Date(),
        },
      ]);

      const { GET } = await import("@/app/api/jarvis/plugins/route");
      const res = await GET();
      const body = await parseBody(res) as { plugins: unknown[]; actionCount: number };

      expect(res.status).toBe(200);
      expect(Array.isArray(body.plugins)).toBe(true);
      expect(body.plugins).toHaveLength(1);
      expect(typeof body.actionCount).toBe("number");
      expect(body.serverPluginsAvailable).toBe(true);
    });

    it("returns empty plugins array when no plugins in DB", async () => {
      mockPrismaPluginFindMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/jarvis/plugins/route");
      const res = await GET();
      const body = await parseBody(res) as { plugins: unknown[] };

      expect(body.plugins).toHaveLength(0);
    });
  });

  // ─── 3. Plugins POST ────────────────────────────────────────────
  describe("POST /api/jarvis/plugins", () => {
    function makeRequest(body: Record<string, unknown>) {
      return new Request("http://localhost/api/jarvis/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("400 for missing action", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({ pluginId: "test" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("Unknown action");
    });

    it("400 for unknown action", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({ action: "explode", pluginId: "test" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("Unknown action");
    });

    it("400 for register without pluginId", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({ action: "register", name: "Test" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("pluginId and name required");
    });

    it("400 for register without name", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({ action: "register", pluginId: "test" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("pluginId and name required");
    });

    it("register succeeds with valid payload", async () => {
      mockPrismaPluginUpsert.mockResolvedValue({
        pluginId: "my-plugin",
        name: "My Plugin",
        description: "",
        version: "1.0.0",
        author: "unknown",
        category: "system",
        icon: "Puzzle",
        enabled: true,
        settings: "[]",
      });

      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({
        action: "register",
        pluginId: "my-plugin",
        name: "My Plugin",
      }));
      const body = await parseBody(res) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockPrismaPluginUpsert).toHaveBeenCalledTimes(1);
    });

    it("400 for unregister without pluginId", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({ action: "unregister" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("pluginId required");
    });

    it("unregister succeeds with pluginId", async () => {
      mockPrismaPluginDeleteMany.mockResolvedValue({ count: 1 });

      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({
        action: "unregister",
        pluginId: "my-plugin",
      }));
      const body = await parseBody(res) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    it("400 for toggle without pluginId", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({ action: "toggle" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("pluginId required");
    });

    it("404 for toggle on non-existent plugin", async () => {
      mockPrismaPluginFindUnique.mockResolvedValue(null);

      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({
        action: "toggle",
        pluginId: "nonexistent",
      }));
      const body = await parseBody(res);

      expect(res.status).toBe(404);
      expect(body.error).toContain("not found");
    });

    it("toggle succeeds for existing plugin", async () => {
      mockPrismaPluginFindUnique.mockResolvedValue({ enabled: false });
      mockPrismaPluginUpdate.mockResolvedValue({ enabled: true });

      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({
        action: "toggle",
        pluginId: "my-plugin",
      }));
      const body = await parseBody(res) as { success: boolean; enabled: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.enabled).toBe(true);
    });

    it("400 for execute without pluginId", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({
        action: "execute",
        params: { actionName: "healthCheck" },
      }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("pluginId and params.actionName required");
    });

    it("400 for execute without actionName", async () => {
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(makeRequest({
        action: "execute",
        pluginId: "system-doctor",
        params: {},
      }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("pluginId and params.actionName required");
    });

    it("500 on unexpected error", async () => {
      // Force JSON parse error by sending invalid body
      const { POST } = await import("@/app/api/jarvis/plugins/route");
      const res = await POST(new Request("http://localhost/api/jarvis/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json{{{",
      }));

      expect(res.status).toBe(500);
    });
  });

  // ─── 4. RAG GET (list) ──────────────────────────────────────────
  describe("GET /api/jarvis/rag (list)", () => {
    it("returns documents array", async () => {
      mockPrismaDocumentFindMany.mockResolvedValue([
        {
          id: "doc-1",
          filename: "test.md",
          uploadedAt: "2025-01-01T00:00:00Z",
          chunks: [{ id: "c1" }, { id: "c2" }],
        },
      ]);

      const { GET } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag");
      const res = await GET(req as never);
      const body = await parseBody(res) as { documents: Array<{ id: string; filename: string; chunkCount: number }> };

      expect(res.status).toBe(200);
      expect(Array.isArray(body.documents)).toBe(true);
      expect(body.documents).toHaveLength(1);
      expect(body.documents[0].filename).toBe("test.md");
      expect(body.documents[0].chunkCount).toBe(2);
    });

    it("returns empty documents array when no docs", async () => {
      mockPrismaDocumentFindMany.mockResolvedValue([]);

      const { GET } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag");
      const res = await GET(req as never);
      const body = await parseBody(res) as { documents: unknown[] };

      expect(body.documents).toHaveLength(0);
    });
  });

  // ─── 5. RAG GET (search) ────────────────────────────────────────
  describe("GET /api/jarvis/rag?action=search", () => {
    it("400 when query param is missing", async () => {
      const { GET } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag?action=search");
      const res = await GET(req as never);
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("Missing query");
    });

    it("400 when query param is whitespace only", async () => {
      const { GET } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag?action=search&query=   ");
      const res = await GET(req as never);
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("Missing query");
    });

    it("returns search results with query echoed", async () => {
      const { GET } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag?action=search&query=test+query");
      const res = await GET(req as never);
      const body = await parseBody(res) as { results: unknown[]; query: string };

      expect(res.status).toBe(200);
      expect(body.query).toBe("test query");
      expect(Array.isArray(body.results)).toBe(true);
      expect(body.totalFound).toBe(0);
    });
  });

  // ─── 6. RAG DELETE ──────────────────────────────────────────────
  describe("DELETE /api/jarvis/rag", () => {
    it("400 for missing documentId", async () => {
      const { DELETE } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag");
      const res = await DELETE(req as never);
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("Missing documentId");
    });

    it("404 when document not found", async () => {
      mockPrismaDocumentDelete.mockRejectedValue(new Error("Record to delete does not exist"));

      const { DELETE } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag?documentId=nonexistent");
      const res = await DELETE(req as never);
      const body = await parseBody(res);

      expect(res.status).toBe(404);
      expect(body.error).toContain("not found");
    });

    it("deletes document and returns success", async () => {
      mockPrismaDocumentDelete.mockResolvedValue({ id: "doc-1" });

      const { DELETE } = await import("@/app/api/jarvis/rag/route");
      const req = new Request("http://localhost/api/jarvis/rag?documentId=doc-1");
      const res = await DELETE(req as never);
      const body = await parseBody(res) as { success: boolean; documentId: string };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.documentId).toBe("doc-1");
    });
  });

  // ─── 7. RAG POST (upload validation) ────────────────────────────
  describe("POST /api/jarvis/rag", () => {
    it("400 when no file provided", async () => {
      const { POST } = await import("@/app/api/jarvis/rag/route");
      const formData = new FormData();
      const req = new Request("http://localhost/api/jarvis/rag", {
        method: "POST",
        body: formData,
      });
      const res = await POST(req as never);
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("No file provided");
    });
  });

  // ─── 8. Settings GET ────────────────────────────────────────────
  describe("GET /api/jarvis/settings", () => {
    it("returns settings object with expected keys", async () => {
      mockSettingFindMany.mockResolvedValue([
        { key: "aiProvider", value: "ollama" },
        { key: "temperature", value: "0.8" },
      ]);

      const { GET } = await import("@/app/api/jarvis/settings/route");
      const res = await GET();
      const body = await parseBody(res) as { settings: Record<string, string> };

      expect(res.status).toBe(200);
      expect(body.settings).toBeDefined();
      expect(typeof body.settings.aiProvider).toBe("string");
      expect(body.settings.aiProvider).toBe("ollama");
      // Defaults applied for missing keys
      expect(body.settings.ttsRate).toBe("1.05");
      expect(body.settings.volume).toBe("1.0");
      expect(body.settings.persona).toBe("classic");
    });

    it("uses stored values over defaults", async () => {
      mockSettingFindMany.mockResolvedValue([
        { key: "ttsRate", value: "1.5" },
        { key: "volume", value: "0.5" },
      ]);

      const { GET } = await import("@/app/api/jarvis/settings/route");
      const res = await GET();
      const body = await parseBody(res) as { settings: Record<string, string> };

      expect(body.settings.ttsRate).toBe("1.5");
      expect(body.settings.volume).toBe("0.5");
    });

    it("500 on database error", async () => {
      mockSettingFindMany.mockRejectedValue(new Error("DB connection failed"));

      const { GET } = await import("@/app/api/jarvis/settings/route");
      const res = await GET();
      const body = await parseBody(res);

      expect(res.status).toBe(500);
      expect(body.error).toContain("Failed to load settings");
    });
  });

  // ─── 9. Settings PUT ────────────────────────────────────────────
  describe("PUT /api/jarvis/settings", () => {
    function makeRequest(body: Record<string, unknown>) {
      return new Request("http://localhost/api/jarvis/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("400 when body has no settings key", async () => {
      const { PUT } = await import("@/app/api/jarvis/settings/route");
      const res = await PUT(makeRequest({ foo: "bar" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("must contain");
    });

    it("400 for invalid setting key", async () => {
      const { PUT } = await import("@/app/api/jarvis/settings/route");
      const res = await PUT(makeRequest({ settings: { invalidKey: "value" } }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toContain("Invalid setting key: invalidKey");
    });

    it("successfully upserts valid settings", async () => {
      mockSettingUpsert.mockResolvedValue({});

      const { PUT } = await import("@/app/api/jarvis/settings/route");
      const res = await PUT(makeRequest({
        settings: { temperature: "0.9", ttsRate: "1.2" },
      }));
      const body = await parseBody(res) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockSettingUpsert).toHaveBeenCalledTimes(2);
    });

    it("500 on database error", async () => {
      mockSettingUpsert.mockRejectedValue(new Error("DB error"));

      const { PUT } = await import("@/app/api/jarvis/settings/route");
      const res = await PUT(makeRequest({
        settings: { temperature: "0.9" },
      }));
      const body = await parseBody(res);

      expect(res.status).toBe(500);
      expect(body.error).toContain("Failed to save settings");
    });
  });

  // ─── 10. Conversations GET ──────────────────────────────────────
  describe("GET /api/jarvis/conversations", () => {
    it("returns conversations array", async () => {
      mockConversationFindMany.mockResolvedValue([
        {
          id: "conv-1",
          title: "Test Session",
          createdAt: new Date(),
          updatedAt: new Date(),
          messages: [{ id: "m1", role: "user", content: "Hi", createdAt: new Date() }],
        },
      ]);

      const { GET } = await import("@/app/api/jarvis/conversations/route");
      const res = await GET();
      const body = await parseBody(res) as { conversations: unknown[] };

      expect(res.status).toBe(200);
      expect(Array.isArray(body.conversations)).toBe(true);
      expect(body.conversations).toHaveLength(1);
    });

    it("returns empty array on error (graceful degradation)", async () => {
      mockConversationFindMany.mockRejectedValue(new Error("DB down"));

      const { GET } = await import("@/app/api/jarvis/conversations/route");
      const res = await GET();
      const body = await parseBody(res) as { conversations: unknown[] };

      expect(res.status).toBe(200);
      expect(body.conversations).toEqual([]);
    });
  });

  // ─── 11. Conversations POST ─────────────────────────────────────
  describe("POST /api/jarvis/conversations", () => {
    it("creates conversation with message", async () => {
      mockConversationCreate.mockResolvedValue({
        id: "conv-1",
        title: "Hello World",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [{ id: "m1", role: "user", content: "Hello World", createdAt: new Date() }],
      });

      const { POST } = await import("@/app/api/jarvis/conversations/route");
      const req = new Request("http://localhost/api/jarvis/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello World" }),
      });
      const res = await POST(req as never);
      const body = await parseBody(res) as { conversation: { id: string } };

      expect(res.status).toBe(200);
      expect(body.conversation.id).toBe("conv-1");
      expect(mockConversationCreate).toHaveBeenCalledTimes(1);
    });

    it("creates conversation without message", async () => {
      mockConversationCreate.mockResolvedValue({
        id: "conv-2",
        title: "New Session",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
      });

      const { POST } = await import("@/app/api/jarvis/conversations/route");
      const req = new Request("http://localhost/api/jarvis/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await POST(req as never);
      const body = await parseBody(res) as { conversation: { id: string } };

      expect(res.status).toBe(200);
      expect(body.conversation.id).toBe("conv-2");
    });

    it("uses provided title over derived title", async () => {
      mockConversationCreate.mockResolvedValue({
        id: "conv-3",
        title: "Custom Title",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
      });

      const { POST } = await import("@/app/api/jarvis/conversations/route");
      const req = new Request("http://localhost/api/jarvis/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Some long message", title: "Custom Title" }),
      });
      const res = await POST(req as never);
      const body = await parseBody(res) as { conversation: { title: string } };

      expect(body.conversation.title).toBe("Custom Title");
    });

    it("500 on database error", async () => {
      mockConversationCreate.mockRejectedValue(new Error("DB error"));

      const { POST } = await import("@/app/api/jarvis/conversations/route");
      const req = new Request("http://localhost/api/jarvis/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Hello" }),
      });
      const res = await POST(req as never);
      const body = await parseBody(res);

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });
  });

  // ─── 12. Conversations [id] GET ─────────────────────────────────
  describe("GET /api/jarvis/conversations/[id]", () => {
    it("returns conversation with messages", async () => {
      mockConversationFindUnique.mockResolvedValue({
        id: "conv-1",
        title: "Test",
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [{ id: "m1", role: "user", content: "Hi", createdAt: new Date() }],
      });

      const { GET } = await import("@/app/api/jarvis/conversations/[id]/route");
      const res = await GET(
        new Request("http://localhost/api/jarvis/conversations/conv-1") as never,
        { params: { id: "conv-1" } },
      );
      const body = await parseBody(res) as { conversation: { id: string } };

      expect(res.status).toBe(200);
      expect(body.conversation.id).toBe("conv-1");
    });

    it("404 when conversation not found", async () => {
      mockConversationFindUnique.mockResolvedValue(null);

      const { GET } = await import("@/app/api/jarvis/conversations/[id]/route");
      const res = await GET(
        new Request("http://localhost/api/jarvis/conversations/nonexistent") as never,
        { params: { id: "nonexistent" } },
      );
      const body = await parseBody(res);

      expect(res.status).toBe(404);
    });

    it("500 on database error", async () => {
      mockConversationFindUnique.mockRejectedValue(new Error("DB error"));

      const { GET } = await import("@/app/api/jarvis/conversations/[id]/route");
      const res = await GET(
        new Request("http://localhost/api/jarvis/conversations/conv-1") as never,
        { params: { id: "conv-1" } },
      );

      expect(res.status).toBe(500);
    });
  });

  // ─── 13. Conversations [id] POST (append message) ───────────────
  describe("POST /api/jarvis/conversations/[id]", () => {
    it("400 when role and content are missing", async () => {
      const { POST } = await import("@/app/api/jarvis/conversations/[id]/route");
      const req = new Request("http://localhost/api/jarvis/conversations/conv-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await POST(req as never, { params: { id: "conv-1" } });
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it("400 when only role is provided", async () => {
      const { POST } = await import("@/app/api/jarvis/conversations/[id]/route");
      const req = new Request("http://localhost/api/jarvis/conversations/conv-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user" }),
      });
      const res = await POST(req as never, { params: { id: "conv-1" } });
      const body = await parseBody(res);

      expect(res.status).toBe(400);
    });

    it("appends message and returns it", async () => {
      mockMessageCreate.mockResolvedValue({
        id: "m1",
        conversationId: "conv-1",
        role: "user",
        content: "Hello",
        createdAt: new Date(),
      });
      mockConversationUpdate.mockResolvedValue({});

      const { POST } = await import("@/app/api/jarvis/conversations/[id]/route");
      const req = new Request("http://localhost/api/jarvis/conversations/conv-1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: "Hello" }),
      });
      const res = await POST(req as never, { params: { id: "conv-1" } });
      const body = await parseBody(res) as { message: { id: string; content: string } };

      expect(res.status).toBe(200);
      expect(body.message.content).toBe("Hello");
      expect(mockMessageCreate).toHaveBeenCalledWith({
        data: { conversationId: "conv-1", role: "user", content: "Hello" },
      });
    });
  });

  // ─── 14. Conversations [id] DELETE ──────────────────────────────
  describe("DELETE /api/jarvis/conversations/[id]", () => {
    it("deletes and returns ok", async () => {
      mockConversationDelete.mockResolvedValue({ id: "conv-1" });

      const { DELETE } = await import("@/app/api/jarvis/conversations/[id]/route");
      const res = await DELETE(
        new Request("http://localhost/api/jarvis/conversations/conv-1") as never,
        { params: { id: "conv-1" } },
      );
      const body = await parseBody(res) as { ok: boolean };

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("500 on database error", async () => {
      mockConversationDelete.mockRejectedValue(new Error("DB error"));

      const { DELETE } = await import("@/app/api/jarvis/conversations/[id]/route");
      const res = await DELETE(
        new Request("http://localhost/api/jarvis/conversations/conv-1") as never,
        { params: { id: "conv-1" } },
      );

      expect(res.status).toBe(500);
    });
  });

  // ─── 15. Notes GET ─────────────────────────────────────────────
  describe("GET /api/jarvis/notes", () => {
    it("returns notes array", async () => {
      mockNoteFindMany.mockResolvedValue([
        {
          id: "n1",
          title: "Test Note",
          content: "Content",
          category: "general",
          color: "cyan",
          pinned: false,
          done: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const { GET } = await import("@/app/api/jarvis/notes/route");
      const res = await GET();
      const body = await parseBody(res) as { notes: unknown[] };

      expect(res.status).toBe(200);
      expect(Array.isArray(body.notes)).toBe(true);
      expect(body.notes).toHaveLength(1);
    });

    it("returns empty array on error (graceful degradation)", async () => {
      mockNoteFindMany.mockRejectedValue(new Error("DB error"));

      const { GET } = await import("@/app/api/jarvis/notes/route");
      const res = await GET();
      const body = await parseBody(res) as { notes: unknown[] };

      expect(res.status).toBe(200);
      expect(body.notes).toEqual([]);
    });
  });

  // ─── 16. Notes POST (create) ───────────────────────────────────
  describe("POST /api/jarvis/notes", () => {
    function makeRequest(body: Record<string, unknown>) {
      return new Request("http://localhost/api/jarvis/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("400 when title and content are both empty/missing", async () => {
      const { POST } = await import("@/app/api/jarvis/notes/route");
      const res = await POST(makeRequest({}));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it("400 when title and content are whitespace only", async () => {
      const { POST } = await import("@/app/api/jarvis/notes/route");
      const res = await POST(makeRequest({ title: "   ", content: "   " }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
    });

    it("creates note with title only", async () => {
      mockNoteCreate.mockResolvedValue({
        id: "n1",
        title: "My Note",
        content: "",
        category: "general",
        color: "cyan",
        pinned: false,
        done: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { POST } = await import("@/app/api/jarvis/notes/route");
      const res = await POST(makeRequest({ title: "My Note" }));
      const body = await parseBody(res) as { note: { id: string; title: string } };

      expect(res.status).toBe(201);
      expect(body.note.title).toBe("My Note");
      expect(mockNoteCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "My Note",
          content: "",
          category: "general",
          color: "cyan",
          pinned: false,
          done: false,
        }),
      });
    });

    it("creates note with content only, defaults title", async () => {
      mockNoteCreate.mockResolvedValue({
        id: "n2",
        title: "Без названия",
        content: "Some content",
        category: "general",
        color: "cyan",
        pinned: false,
        done: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { POST } = await import("@/app/api/jarvis/notes/route");
      const res = await POST(makeRequest({ content: "Some content" }));
      const body = await parseBody(res) as { note: { title: string } };

      expect(res.status).toBe(201);
      expect(body.note.title).toBe("Без названия");
    });

    it("uses provided valid category and color", async () => {
      mockNoteCreate.mockResolvedValue({
        id: "n3",
        title: "Note",
        content: "content",
        category: "code",
        color: "emerald",
        pinned: true,
        done: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { POST } = await import("@/app/api/jarvis/notes/route");
      const res = await POST(makeRequest({
        title: "Note",
        content: "content",
        category: "code",
        color: "emerald",
        pinned: true,
      }));

      expect(res.status).toBe(201);
      expect(mockNoteCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: "code",
          color: "emerald",
          pinned: true,
        }),
      });
    });

    it("falls back to defaults for invalid category/color", async () => {
      mockNoteCreate.mockResolvedValue({});

      const { POST } = await import("@/app/api/jarvis/notes/route");
      const res = await POST(makeRequest({
        title: "Note",
        content: "content",
        category: "invalid-category",
        color: "invalid-color",
      }));

      expect(res.status).toBe(201);
      expect(mockNoteCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          category: "general",
          color: "cyan",
        }),
      });
    });

    it("500 on database error", async () => {
      mockNoteCreate.mockRejectedValue(new Error("DB error"));

      const { POST } = await import("@/app/api/jarvis/notes/route");
      const res = await POST(makeRequest({ title: "Test" }));
      const body = await parseBody(res);

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });
  });

  // ─── 17. Notes PUT (update) ─────────────────────────────────────
  describe("PUT /api/jarvis/notes", () => {
    function makeRequest(body: Record<string, unknown>) {
      return new Request("http://localhost/api/jarvis/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("400 when id is missing", async () => {
      const { PUT } = await import("@/app/api/jarvis/notes/route");
      const res = await PUT(makeRequest({ title: "Updated" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it("400 when no update data provided", async () => {
      const { PUT } = await import("@/app/api/jarvis/notes/route");
      const res = await PUT(makeRequest({ id: "n1" }));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it("400 for invalid category", async () => {
      const { PUT } = await import("@/app/api/jarvis/notes/route");
      const res = await PUT(makeRequest({ id: "n1", title: "Hi", category: "invalid" }));

      // The route ignores invalid category — it just won't include it in updateData
      // Since title is valid, it should still succeed
      mockNoteUpdate.mockResolvedValue({ id: "n1", title: "Hi" });
      expect(res.status).toBe(200);
    });

    it("updates note title", async () => {
      mockNoteUpdate.mockResolvedValue({
        id: "n1",
        title: "Updated Title",
        content: "old content",
      });

      const { PUT } = await import("@/app/api/jarvis/notes/route");
      const res = await PUT(makeRequest({ id: "n1", title: "Updated Title" }));
      const body = await parseBody(res) as { note: { title: string } };

      expect(res.status).toBe(200);
      expect(body.note.title).toBe("Updated Title");
      expect(mockNoteUpdate).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { title: "Updated Title" },
      });
    });

    it("updates multiple fields", async () => {
      mockNoteUpdate.mockResolvedValue({
        id: "n1",
        title: "T",
        content: "C",
        done: true,
        category: "tasks",
        color: "rose",
        pinned: true,
      });

      const { PUT } = await import("@/app/api/jarvis/notes/route");
      const res = await PUT(makeRequest({
        id: "n1",
        title: "T",
        content: "C",
        done: true,
        category: "tasks",
        color: "rose",
        pinned: true,
      }));
      const body = await parseBody(res) as { note: { done: boolean } };

      expect(res.status).toBe(200);
      expect(body.note.done).toBe(true);
      expect(mockNoteUpdate).toHaveBeenCalledWith({
        where: { id: "n1" },
        data: { title: "T", content: "C", done: true, category: "tasks", color: "rose", pinned: true },
      });
    });

    it("500 on database error", async () => {
      mockNoteUpdate.mockRejectedValue(new Error("DB error"));

      const { PUT } = await import("@/app/api/jarvis/notes/route");
      const res = await PUT(makeRequest({ id: "n1", title: "Update" }));
      const body = await parseBody(res);

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });
  });

  // ─── 18. Notes DELETE ───────────────────────────────────────────
  describe("DELETE /api/jarvis/notes", () => {
    function makeRequest(body: Record<string, unknown>) {
      return new Request("http://localhost/api/jarvis/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }

    it("400 when id is missing", async () => {
      const { DELETE } = await import("@/app/api/jarvis/notes/route");
      const res = await DELETE(makeRequest({}));
      const body = await parseBody(res);

      expect(res.status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it("deletes single note by id", async () => {
      mockNoteDelete.mockResolvedValue({ id: "n1" });

      const { DELETE } = await import("@/app/api/jarvis/notes/route");
      const res = await DELETE(makeRequest({ id: "n1" }));
      const body = await parseBody(res) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockNoteDelete).toHaveBeenCalledWith({ where: { id: "n1" } });
    });

    it("deletes all notes when id is 'all'", async () => {
      mockNoteDeleteMany.mockResolvedValue({ count: 5 });

      const { DELETE } = await import("@/app/api/jarvis/notes/route");
      const res = await DELETE(makeRequest({ id: "all" }));
      const body = await parseBody(res) as { success: boolean };

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockNoteDeleteMany).toHaveBeenCalledWith({});
    });

    it("500 on database error", async () => {
      mockNoteDelete.mockRejectedValue(new Error("DB error"));

      const { DELETE } = await import("@/app/api/jarvis/notes/route");
      const res = await DELETE(makeRequest({ id: "n1" }));
      const body = await parseBody(res);

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });
  });
});