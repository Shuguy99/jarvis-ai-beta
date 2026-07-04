import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed, retryAfterMs } = checkRateLimit(ip, 30, 60_000);
  if (!allowed) {
    return json({ error: "Rate limit exceeded", retryAfterMs }, {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
    });
  }

  return json({
    results: [],
    available: ai.isSearchAvailable(),
    message: "Веб-поиск недоступен в локальном режиме (Ollama). Установите SearXNG или подключите поисковый API для включения.",
    timestamp: new Date().toISOString(),
  });
}