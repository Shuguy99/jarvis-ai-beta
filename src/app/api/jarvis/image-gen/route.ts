import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
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