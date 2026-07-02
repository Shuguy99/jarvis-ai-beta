import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/vision
 * Body: { image: string (base64 data-url or raw base64), prompt?: string }
 * Returns: { reply: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { image, prompt } = await req.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json(
        { error: "Изображение не предоставлено." },
        { status: 400 }
      );
    }

    if (!ai.isVisionAvailable()) {
      return NextResponse.json(
        { error: "Анализ изображений недоступен. Задайте OPENAI_API_KEY в .env." },
        { status: 503 }
      );
    }

    const question =
      prompt || "Опиши это изображение подробно на русском языке, как это сделал бы J.A.R.V.I.S. из Железного Человека.";

    const reply = (await ai.vision(image, question)).content;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("JARVIS Vision error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Анализ изображений недоступен.",
      },
      { status: 500 }
    );
  }
}