import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ai } from "@/lib/ai-provider";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfterMs } = checkRateLimit(ip, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limit exceeded", retryAfterMs }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }

  return NextResponse.json({
    results: [],
    available: ai.isSearchAvailable(),
    message: "Веб-поиск недоступен в локальном режиме (Ollama). Установите SearXNG или подключите поисковый API для включения.",
    timestamp: new Date().toISOString(),
  });
}