import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed, retryAfterMs } = checkRateLimit(ip, 10, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded", retryAfterMs }, {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const { prompt } = await req.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: "Генерация изображений недоступна с Ollama. Эта функция требует DALL-E/Stable Diffusion API.",
        imageGenUnavailable: true,
      },
      { status: 501 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error." },
      { status: 500 }
    );
  }
}