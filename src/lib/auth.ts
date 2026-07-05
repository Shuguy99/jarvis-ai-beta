/**
 * JARVIS Auth — OAuth & local authentication
 *
 * Provides JWT-like token generation, user management via localStorage,
 * password hashing via SubtleCrypto (SHA-256), and OAuth config storage.
 */

// ─── Types ────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  provider: "local" | "github" | "google";
  role: "admin" | "user" | "guest";
  createdAt: string;
  lastLogin: string;
  passwordHash?: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}

export interface OAuthConfig {
  githubClientId?: string;
  githubClientSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  jwtSecret: string;
  tokenExpiryHours: number;
}

// ─── Constants ────────────────────────────────────────────────────

const USERS_KEY = "jarvis-auth-users";
const OAUTH_CONFIG_KEY = "jarvis-oauth-config";
const TOKEN_KEY = "jarvis-auth-token";

// ─── Token helpers (JWT-like: base64-encoded JSON) ───────────────

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

export async function generateToken(
  userId: string,
  secret: string,
  email?: string,
  role?: string,
  expiryHours?: number,
): Promise<string> {
  const config = getOAuthConfig();
  const hours = expiryHours ?? config.tokenExpiryHours;
  const now = Math.floor(Date.now() / 1000);

  const payload: TokenPayload = {
    userId,
    email: email ?? "",
    role: role ?? "user",
    iat: now,
    exp: now + hours * 3600,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));

  // Simple HMAC-like signature using SHA-256 over header + "." + body + secret
  const signatureInput = `${header}.${body}.${secret}`;
  const encoded = new TextEncoder().encode(signatureInput);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hash);
  let signature = "";
  for (const byte of hashArray) signature += String.fromCharCode(byte);
  const sig = base64UrlEncode(signature);

  return `${header}.${body}.${sig}`;
}

export function validateToken(token: string, secret: string): TokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, sig] = parts;
    const now = Math.floor(Date.now() / 1000);

    const payload: TokenPayload = JSON.parse(base64UrlDecode(body));

    // Check expiry
    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── User CRUD (localStorage) ────────────────────────────────────

export function getUsers(): AuthUser[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveUsers(users: AuthUser[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ─── Password hashing (SHA-256 via SubtleCrypto) ─────────────────

async function hashPassword(password: string): Promise<string> {
  const encoded = new TextEncoder().encode(password);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hash);
  let binary = "";
  for (const byte of hashArray) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// ─── Register / Login ─────────────────────────────────────────────

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<AuthToken> {
  const users = getUsers();
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error("User already exists");
  }

  const passwordHash = await hashPassword(password);
  const config = getOAuthConfig();
  const now = new Date().toISOString();

  const user: AuthUser = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name,
    provider: "local",
    role: "admin",
    createdAt: now,
    lastLogin: now,
    passwordHash,
  };

  users.push(user);
  saveUsers(users);

  const accessToken = await generateToken(user.id, config.jwtSecret, user.email, user.role);
  const refreshToken = generateRefreshToken();
  const expiresAt = Date.now() + config.tokenExpiryHours * 3600 * 1000;

  const token: AuthToken = { accessToken, refreshToken, expiresAt, userId: user.id };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));

  return token;
}

export async function loginUser(
  email: string,
  password: string,
): Promise<AuthToken> {
  const users = getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash) {
    throw new Error("Invalid credentials");
  }

  const config = getOAuthConfig();
  user.lastLogin = new Date().toISOString();
  saveUsers(users);

  const accessToken = await generateToken(user.id, config.jwtSecret, user.email, user.role);
  const refreshToken = generateRefreshToken();
  const expiresAt = Date.now() + config.tokenExpiryHours * 3600 * 1000;

  const token: AuthToken = { accessToken, refreshToken, expiresAt, userId: user.id };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));

  return token;
}

// ─── OAuth config ─────────────────────────────────────────────────

const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
  jwtSecret: "jarvis-default-secret-change-me",
  tokenExpiryHours: 24,
};

export function getOAuthConfig(): OAuthConfig {
  if (typeof localStorage === "undefined") return DEFAULT_OAUTH_CONFIG;
  try {
    const raw = localStorage.getItem(OAUTH_CONFIG_KEY);
    return raw ? { ...DEFAULT_OAUTH_CONFIG, ...JSON.parse(raw) } : DEFAULT_OAUTH_CONFIG;
  } catch {
    return DEFAULT_OAUTH_CONFIG;
  }
}

export function saveOAuthConfig(config: OAuthConfig): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(OAUTH_CONFIG_KEY, JSON.stringify(config));
}

// ─── Current user / logout ────────────────────────────────────────

export function getCurrentUser(): AuthUser | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;

    const token: AuthToken = JSON.parse(raw);
    if (token.expiresAt < Date.now()) return null;

    const config = getOAuthConfig();
    const payload = validateToken(token.accessToken, config.jwtSecret);
    if (!payload) return null;

    const users = getUsers();
    return users.find((u) => u.id === payload.userId) ?? null;
  } catch {
    return null;
  }
}

export function logout(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}