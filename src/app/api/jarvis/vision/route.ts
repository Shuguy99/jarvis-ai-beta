import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { image, prompt } = await req.json();

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Изображение не предоставлено." }, { status: 400 });
    }

    const question =
      prompt || "Опиши это изображение подробно на русском языке, как это сделал бы J.A.R.V.I.S.";

    const reply = (await ai.vision(image, question)).content;

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("JARVIS Vision error:", error);

    const msg = error instanceof Error ? error.message : "Ошибка анализа.";

    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      return NextResponse.json(
        { error: "Ollama не запущен. Убедитесь, что vision-модель загружена: ollama pull llava" },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}