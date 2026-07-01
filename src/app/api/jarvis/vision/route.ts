import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

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

    const question =
      prompt || "Опиши это изображение подробно на русском языке, как это сделал бы J.A.R.V.I.S. из Железного Человека.";

    const zai = await ZAI.create();

    // Нормализуем base64 — если это data:url, используем как есть; иначе оборачиваем
    const imageUrl = image.startsWith("data:")
      ? image
      : `data:image/jpeg;base64,${image}`;

    const response = await zai.chat.completions.createVision({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: question },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
      thinking: { type: "disabled" },
    });

    const reply =
      response.choices?.[0]?.message?.content || "Не удалось проанализировать изображение.";

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