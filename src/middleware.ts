import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * JARVIS Security Middleware — Phase 0
 *
 * All /api/jarvis/* routes are protected:
 * 1. Origin check — only localhost / 127.0.0.1 / Electron shell
 * 2. Brute-force blocklist for sensitive endpoints (processes, files, agent)
 */

const SENSITIVE_PREFIXES = [
  "/api/jarvis/processes",
  "/api/jarvis/files",
  "/api/jarvis/agent",
  "/api/jarvis/search-files",
];

// In-memory rate limiter: endpoint + IP → { count, resetAt }
const rateLimiter = new Map<
  string,
  { count: number; resetAt: number }
>();

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // per window
const SENSITIVE_RATE_LIMIT = 10; // stricter for dangerous endpoints

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

function isRateLimited(ip: string, path: string): boolean {
  const isSensitive = SENSITIVE_PREFIXES.some((p) => path.startsWith(p));
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // ── Rate limiting ───────────────────────────────────────────
  const ip = getClientIp(request);
  if (isRateLimited(ip, pathname)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Slowing down." },
      { status: 429 }
    );
  }

  // ── Origin check ────────────────────────────────────────────
  const origin = request.headers.get("origin") ?? "";
  const referer = request.headers.get("referer") ?? "";
  const host = request.headers.get("host") ?? "";

  // Allowed: no origin (server-side, Electron, curl), localhost, 127.0.0.1
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

  // Also allow Electron (custom protocol)
  const isElectron =
    origin.startsWith("app://") ||
    origin.startsWith("file://") ||
    origin === "null"; // Electron sends "null" for file://

  if (!isLocalRequest && !isElectron) {
    return NextResponse.json(
      { error: "Forbidden: external access blocked" },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};