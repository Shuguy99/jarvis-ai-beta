import { json } from "@/lib/json-response";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed, retryAfterMs } = checkRateLimit(ip, 10, 60_000);
    if (!allowed) {
      return json({ error: "Rate limit exceeded", retryAfterMs }, {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const { prompt } = await req.json();

    if (!prompt || !prompt.trim()) {
      return json({ error: "Prompt is required." }, 400);
    }

    return json(
      {
        error: "Генерация изображений недоступна с Ollama. Эта функция требует DALL-E/Stable Diffusion API.",
        imageGenUnavailable: true,
      },
      501
    );
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Internal error." },
      500
    );
  }
}