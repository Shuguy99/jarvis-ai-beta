/**
 * Remote Access — session management for controlling JARVIS remotely.
 * Sessions are stored in localStorage and expire after 24 hours.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface RemoteSessionPermissions {
  chat: boolean;
  voice: boolean;
  settings: boolean;
}

export interface RemoteSession {
  id: string;
  name: string;
  device: string;
  accessCode: string;
  createdAt: number;
  lastActive: number;
  permissions: RemoteSessionPermissions;
}

const STORAGE_KEY = "jarvis-remote-sessions";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Helpers ─────────────────────────────────────────────────────────

function isExpired(session: RemoteSession): boolean {
  return Date.now() - session.lastActive > SESSION_TTL_MS;
}

// ─── Public API ──────────────────────────────────────────────────────

/** Read all sessions, automatically pruning expired ones. */
export function getSessions(): RemoteSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const sessions: RemoteSession[] = JSON.parse(raw);
    // Prune expired
    const active = sessions.filter((s) => !isExpired(s));
    if (active.length !== sessions.length) {
      saveSessions(active);
    }
    return active;
  } catch {
    return [];
  }
}

/** Persist sessions to localStorage. */
export function saveSessions(sessions: RemoteSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** Generate a cryptographically random 6-digit numeric code. */
export function generateAccessCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, "0");
}

/** Validate a 6-digit code against active sessions. Returns the session or null. */
export function validateAccessCode(code: string): RemoteSession | null {
  const sessions = getSessions();
  return sessions.find((s) => s.accessCode === code && !isExpired(s)) ?? null;
}

/** Create a new remote session with a generated access code. */
export function createSession(
  name: string,
  device: string,
): RemoteSession {
  const sessions = getSessions();
  const session: RemoteSession = {
    id: crypto.randomUUID(),
    name: name.trim(),
    device: device.trim(),
    accessCode: generateAccessCode(),
    createdAt: Date.now(),
    lastActive: Date.now(),
    permissions: { chat: true, voice: false, settings: false },
  };
  saveSessions([session, ...sessions]);
  return session;
}

/** Revoke (remove) a session by id. */
export function revokeSession(id: string): boolean {
  const sessions = getSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  if (filtered.length === sessions.length) return false;
  saveSessions(filtered);
  return true;
}

/** Update permissions for a session. */
export function updateSessionPermissions(
  id: string,
  permissions: Partial<RemoteSessionPermissions>,
): boolean {
  const sessions = getSessions();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  sessions[idx].permissions = { ...sessions[idx].permissions, ...permissions };
  sessions[idx].lastActive = Date.now();
  saveSessions(sessions);
  return true;
}

/** Touch a session (update lastActive). */
export function touchSession(id: string): boolean {
  const sessions = getSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session) return false;
  session.lastActive = Date.now();
  saveSessions(sessions);
  return true;
}