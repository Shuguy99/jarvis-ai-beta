import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import path from "path";

// ─── Import all route handlers ──────────────────────────────────────────────

import * as rootRoute from "../src/app/api/route";
import * as chatRoute from "../src/app/api/jarvis/chat/route";
import * as chatStreamRoute from "../src/app/api/jarvis/chat/stream/route";
import * as convosRoute from "../src/app/api/jarvis/conversations/route";
import * as convoByIdRoute from "../src/app/api/jarvis/conversations/[id]/route";
import * as agentRoute from "../src/app/api/jarvis/agent/route";
import * as agentExecuteRoute from "../src/app/api/jarvis/agent/execute/route";
import * as agentStreamRoute from "../src/app/api/jarvis/agent/stream/route";
import * as asrRoute from "../src/app/api/jarvis/asr/route";
import * as filesRoute from "../src/app/api/jarvis/files/route";
import * as githubRoute from "../src/app/api/jarvis/github/route";
import * as imageGenRoute from "../src/app/api/jarvis/image-gen/route";
import * as insightsRoute from "../src/app/api/jarvis/insights/route";
import * as notesRoute from "../src/app/api/jarvis/notes/route";
import * as pluginsRoute from "../src/app/api/jarvis/plugins/route";
import * as processesRoute from "../src/app/api/jarvis/processes/route";
import * as providersRoute from "../src/app/api/jarvis/providers/route";
import * as ragRoute from "../src/app/api/jarvis/rag/route";
import * as searchFilesRoute from "../src/app/api/jarvis/search-files/route";
import * as searchRoute from "../src/app/api/jarvis/search/route";
import * as settingsRoute from "../src/app/api/jarvis/settings/route";
import * as systemRoute from "../src/app/api/jarvis/system/route";
import * as ttsRoute from "../src/app/api/jarvis/tts/route";
import * as visionRoute from "../src/app/api/jarvis/vision/route";
import * as voiceParseRoute from "../src/app/api/jarvis/voice-parse/route";
import * as weatherRoute from "../src/app/api/jarvis/weather/route";
import * as analyticsRoute from "../src/app/api/jarvis/analytics/route";

// ─── Rate limiter + Origin check middleware (from src/middleware.ts) ───────

const SENSITIVE_PREFIXES = [
  "/api/jarvis/processes",
  "/api/jarvis/files",
  "/api/jarvis/agent",
  "/api/jarvis/search-files",
];

const rateLimiter = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const SENSITIVE_RATE_LIMIT = 10;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

function isRateLimited(ip: string, pathname: string): boolean {
  const isSensitive = SENSITIVE_PREFIXES.some((p) => pathname.startsWith(p));
  const maxRequests = isSensitive ? SENSITIVE_RATE_LIMIT : RATE_LIMIT_MAX_REQUESTS;

  const now = Date.now();
  const key = `${ip}:${isSensitive ? "S" : "N"}`;
  const entry = rateLimiter.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimiter.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > maxRequests;
}

function securityMiddleware() {
  return async (c: Hono.Context, next: Hono.Next) => {
    const pathname = new URL(c.req.url).pathname;

    if (!pathname.startsWith("/api/")) {
      return next();
    }

    const ip = getClientIp(c.req.raw);
    if (isRateLimited(ip, pathname)) {
      return c.json({ error: "Rate limit exceeded. Slowing down." }, 429);
    }

    const origin = c.req.header("origin") ?? "";
    const referer = c.req.header("referer") ?? "";
    const host = c.req.header("host") ?? "";

    const isLocalRequest =
      origin === "" ||
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1") ||
      origin.startsWith("http://[::1]") ||
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]") ||
      referer.startsWith("http://localhost") ||
      referer.startsWith("http://127.0.0.1");

    const isElectron =
      origin.startsWith("app://") ||
      origin.startsWith("file://") ||
      origin === "null";

    if (!isLocalRequest && !isElectron) {
      return c.json({ error: "Forbidden: external access blocked" }, 403);
    }

    await next();
  };
}

// ─── Hono App ─────────────────────────────────────────────────────────────

const app = new Hono();

// Global middleware
app.use("*", cors());
app.use("*", securityMiddleware());

// ─── Route registration ────────────────────────────────────────────────────

// Root API
app.get("/api", (c) => rootRoute.GET());
app.post("/api", (c) => rootRoute.POST(c.req.raw));

// Chat
app.get("/api/jarvis/chat", (c) => chatRoute.GET());
app.post("/api/jarvis/chat", (c) => chatRoute.POST(c.req.raw));
app.post("/api/jarvis/chat/stream", (c) => chatStreamRoute.POST(c.req.raw));

// Conversations
app.get("/api/jarvis/conversations", (c) => convosRoute.GET());
app.post("/api/jarvis/conversations", (c) => convosRoute.POST(c.req.raw));
app.get("/api/jarvis/conversations/:id", (c) =>
  convoByIdRoute.GET(c.req.raw, { params: { id: c.req.param("id") } })
);
app.post("/api/jarvis/conversations/:id", (c) =>
  convoByIdRoute.POST(c.req.raw, { params: { id: c.req.param("id") } })
);
app.delete("/api/jarvis/conversations/:id", (c) =>
  convoByIdRoute.DELETE(c.req.raw, { params: { id: c.req.param("id") } })
);

// Agent
app.get("/api/jarvis/agent", (c) => agentRoute.GET());
app.post("/api/jarvis/agent", (c) => agentRoute.POST(c.req.raw));
app.post("/api/jarvis/agent/execute", (c) => agentExecuteRoute.POST(c.req.raw));
app.post("/api/jarvis/agent/stream", (c) => agentStreamRoute.POST(c.req.raw));

// ASR / TTS
app.post("/api/jarvis/asr", (c) => asrRoute.POST());
app.post("/api/jarvis/tts", (c) => ttsRoute.POST());

// Files
app.get("/api/jarvis/files", (c) => filesRoute.GET(c.req.raw));

// GitHub
app.get("/api/jarvis/github", (c) => githubRoute.GET());
app.post("/api/jarvis/github", (c) => githubRoute.POST());

// Image Gen
app.post("/api/jarvis/image-gen", (c) => imageGenRoute.POST(c.req.raw));

// Insights
app.get("/api/jarvis/insights", (c) => insightsRoute.GET());
app.post("/api/jarvis/insights", (c) => insightsRoute.POST(c.req.raw));

// Notes
app.get("/api/jarvis/notes", (c) => notesRoute.GET());
app.post("/api/jarvis/notes", (c) => notesRoute.POST(c.req.raw));
app.put("/api/jarvis/notes", (c) => notesRoute.PUT(c.req.raw));
app.delete("/api/jarvis/notes", (c) => notesRoute.DELETE(c.req.raw));

// Plugins
app.get("/api/jarvis/plugins", (c) => pluginsRoute.GET());
app.post("/api/jarvis/plugins", (c) => pluginsRoute.POST(c.req.raw));

// Processes
app.get("/api/jarvis/processes", (c) => processesRoute.GET(c.req.raw));
app.post("/api/jarvis/processes", (c) => processesRoute.POST(c.req.raw));

// Providers
app.get("/api/jarvis/providers", (c) => providersRoute.GET());

// RAG
app.get("/api/jarvis/rag", (c) => ragRoute.GET(c.req.raw));
app.post("/api/jarvis/rag", (c) => ragRoute.POST(c.req.raw));
app.delete("/api/jarvis/rag", (c) => ragRoute.DELETE(c.req.raw));

// Search
app.post("/api/jarvis/search", (c) => searchRoute.POST(c.req.raw));

// Search Files
app.get("/api/jarvis/search-files", (c) => searchFilesRoute.GET(c.req.raw));

// Settings
app.get("/api/jarvis/settings", (c) => settingsRoute.GET());
app.put("/api/jarvis/settings", (c) => settingsRoute.PUT(c.req.raw));

// System
app.get("/api/jarvis/system", (c) => systemRoute.GET());

// Vision
app.post("/api/jarvis/vision", (c) => visionRoute.POST(c.req.raw));

// Voice Parse
app.post("/api/jarvis/voice-parse", (c) => voiceParseRoute.POST(c.req.raw));

// Weather
app.get("/api/jarvis/weather", (c) => weatherRoute.GET(c.req.raw));

// Analytics
app.get("/api/jarvis/analytics", (c) => analyticsRoute.GET());

// ─── Start server ──────────────────────────────────────────────────────────

const PORT = 3001;

console.log(`[JARVIS] Hono API server starting on port ${PORT}...`);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[JARVIS] API server running at http://localhost:${info.port}`);
});