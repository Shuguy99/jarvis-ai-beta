/**
 * JARVIS Public REST API — External application access
 *
 * Endpoints (dispatched via body action or query param):
 *   GET  /api/jarvis/public              — API info & available endpoints
 *   POST /api/jarvis/public/chat         — Send message to JARVIS
 *   GET  /api/jarvis/public/conversations — List conversations (auth required)
 *   GET  /api/jarvis/public/status       — System status (no auth required)
 *   POST /api/jarvis/public/voice        — Get TTS audio URL
 *
 * Auth: Bearer token via Authorization header (except /status and GET /)
 * Rate limiting: 60 req/min per token
 */

import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";
import { validateToken, getOAuthConfig } from "@/lib/auth";

// ─── In-memory rate limiter (per token) ───────────────────────────

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateStore = new Map<string, RateEntry>();

function checkApiRateLimit(token: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();

  // Cleanup stale
  for (const [key, entry] of rateStore) {
    if (now >= entry.resetAt) rateStore.delete(key);
  }

  const entry = rateStore.get(token);
  if (!entry || now >= entry.resetAt) {
    rateStore.set(token, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count += 1;
  return entry.count <= limit;
}

// ─── Usage stats ──────────────────────────────────────────────────

let totalRequestsToday = 0;
const todayStart = new Date();
todayStart.setHours(0, 0, 0, 0);

function trackRequest(): void {
  const now = new Date();
  if (now >= new Date(todayStart.getTime() + 86400000)) {
    // New day
    totalRequestsToday = 0;
    todayStart.setTime(now.getTime());
    todayStart.setHours(0, 0, 0, 0);
  }
  totalRequestsToday++;
}

// ─── Auth helper ──────────────────────────────────────────────────

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function authenticate(req: Request): { userId: string; role: string } | null {
  const tokenStr = getBearerToken(req);
  if (!tokenStr) return null;
  const config = getOAuthConfig();
  const payload = validateToken(tokenStr, config.jwtSecret);
  if (!payload) return null;
  return { userId: payload.userId, role: payload.role };
}

// ─── API version ──────────────────────────────────────────────────

const API_VERSION = "1.0.0";

// ─── Main handler ─────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);

  // /api/jarvis/public/status — no auth required
  if (url.pathname.endsWith("/status")) {
    try {
      const providerInfo = await ai.getActiveProviderInfo();
      const memUsage = typeof process !== "undefined" && process.memoryUsage
        ? process.memoryUsage()
        : null;

      return json({
        status: "online",
        provider: providerInfo.name,
        chatAvailable: providerInfo.chatAvailable,
        version: API_VERSION,
        memory: memUsage
          ? {
              rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
              heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
            }
          : "N/A",
        uptime: Math.floor(performance.now() / 1000),
      });
    } catch {
      return json({
        status: "online",
        provider: ai.getProviderName(),
        chatAvailable: ai.isChatAvailable(),
        version: API_VERSION,
      });
    }
  }

  // /api/jarvis/public/conversations — auth required
  if (url.pathname.endsWith("/conversations")) {
    const auth = authenticate(req);
    if (!auth) {
      return json({ error: "Unauthorized" }, 401);
    }
    trackRequest();
    return json({
      conversations: [],
      total: 0,
      message: "Conversation history via public API. Use the main chat endpoint.",
    });
  }

  // /api/jarvis/public — API info
  trackRequest();
  return json({
    name: "J.A.R.V.I.S. Public API",
    version: API_VERSION,
    description: "REST API for external application access",
    endpoints: [
      { method: "GET", path: "/api/jarvis/public", description: "API info", auth: false },
      { method: "GET", path: "/api/jarvis/public/status", description: "System status", auth: false },
      { method: "POST", path: "/api/jarvis/public/chat", description: "Send message to JARVIS", auth: true },
      { method: "GET", path: "/api/jarvis/public/conversations", description: "List conversations", auth: true },
      { method: "POST", path: "/api/jarvis/public/voice", description: "Text-to-speech", auth: true },
    ],
    rateLimit: "60 requests/minute per token",
    auth: "Bearer token via Authorization header",
  });
}

export async function POST(req: Request) {
  const url = new URL(req.url);

  // /api/jarvis/public/chat
  if (url.pathname.endsWith("/chat")) {
    const auth = authenticate(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const tokenStr = getBearerToken(req) ?? "unknown";
    if (!checkApiRateLimit(tokenStr)) {
      return json(
        { error: "Rate limit exceeded. Max 60 requests/minute." },
        429,
      );
    }

    trackRequest();

    try {
      const body = await req.json();
      const { message, persona, conversation_id } = body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return json({ error: "message field is required" }, 400);
      }

      const messages = [
        {
          role: "system" as const,
          content:
            "You are J.A.R.V.I.S., an advanced AI assistant. Be helpful, concise, and professional.",
        },
        {
          role: "user" as const,
          content: message,
        },
      ];

      const reply = await ai.chat(messages, {
        temperature: 0.7,
        maxTokens: 2048,
      });

      return json({
        reply: reply.content,
        conversationId: conversation_id ?? null,
        provider: ai.getProviderName(),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Internal error";
      return json({ error: msg }, 500);
    }
  }

  // /api/jarvis/public/voice
  if (url.pathname.endsWith("/voice")) {
    const auth = authenticate(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const tokenStr = getBearerToken(req) ?? "unknown";
    if (!checkApiRateLimit(tokenStr)) {
      return json(
        { error: "Rate limit exceeded. Max 60 requests/minute." },
        429,
      );
    }

    trackRequest();

    try {
      const body = await req.json();
      const { text } = body;

      if (!text || typeof text !== "string" || !text.trim()) {
        return json({ error: "text field is required" }, 400);
      }

      // Generate a TTS URL that points to the internal TTS endpoint
      // In browser/client mode, use browser TTS; for server, generate URL
      const ttsUrl = `/api/jarvis/tts?text=${encodeURIComponent(text.slice(0, 500))}`;

      return json({
        audioUrl: ttsUrl,
        text,
        format: "browser-tts",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Internal error";
      return json({ error: msg }, 500);
    }
  }

  return json({ error: "Unknown endpoint. GET /api/jarvis/public for available endpoints." }, 404);
}