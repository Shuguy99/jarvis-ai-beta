import { json } from "@/lib/json-response";

// ─── In-memory store (server-side mirror) ────────────────────────────
// Sessions are primarily managed client-side via localStorage.
// This API provides a thin server-side mirror for remote clients.

// Since this runs server-side without localStorage, the API acts as a
// validation/proxy layer. The client is always the source of truth.

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

interface ServerSession {
  id: string;
  name: string;
  device: string;
  accessCode: string;
  createdAt: number;
  lastActive: number;
  permissions: { chat: boolean; voice: boolean; settings: boolean };
}

// Simple in-memory store for server-side session tracking
const serverSessions: Map<string, ServerSession> = new Map();

export async function GET() {
  try {
    const now = Date.now();
    const active: ServerSession[] = [];

    // Prune and collect active sessions
    for (const [id, session] of serverSessions) {
      if (now - session.lastActive > SESSION_TTL_MS) {
        serverSessions.delete(id);
      } else {
        active.push(session);
      }
    }

    // If no server-side sessions exist, signal client is source of truth
    if (active.length === 0 && serverSessions.size === 0) {
      return json({ sessions: [], note: "Sessions managed client-side via localStorage." });
    }

    return json({ sessions: active });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    if (action === "create") {
      const { name, device } = body as { name?: string; device?: string };

      if (!name || !device) {
        return json({ error: "name and device are required" }, 400);
      }

      // Generate 6-digit code
      const code = String(
        (crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000),
      ).padStart(6, "0");

      const session: ServerSession = {
        id: crypto.randomUUID(),
        name: name.trim(),
        device: device.trim(),
        accessCode: code,
        createdAt: Date.now(),
        lastActive: Date.now(),
        permissions: { chat: true, voice: false, settings: false },
      };

      serverSessions.set(session.id, session);

      // Also return a note that the client should sync to localStorage
      return json({ success: true, session, note: "Also save client-side via localStorage." });
    }

    if (action === "validate") {
      const { code } = body as { code?: string };

      if (!code || !/^\d{6}$/.test(code)) {
        return json({ error: "A valid 6-digit numeric code is required" }, 400);
      }

      const now = Date.now();
      for (const [id, session] of serverSessions) {
        if (session.accessCode === code && now - session.lastActive <= SESSION_TTL_MS) {
          // Touch the session
          session.lastActive = Date.now();
          serverSessions.set(id, session);
          return json({ valid: true, session });
        }
      }

      return json({ valid: false, error: "Invalid or expired access code" }, 404);
    }

    return json({ error: "Unknown action. Use 'create' or 'validate'." }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Invalid request body" }, 400);
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return json({ error: "id query parameter is required" }, 400);
    }

    const deleted = serverSessions.delete(id);

    if (!deleted) {
      return json({ error: "Session not found" }, 404);
    }

    return json({ success: true, note: "Session revoked", id });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
}