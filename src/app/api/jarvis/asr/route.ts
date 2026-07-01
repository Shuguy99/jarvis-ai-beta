import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/asr
 * Body: { audio: base64string }
 * Returns: { text }
 */
export async function POST(req: NextRequest) {
  try {
    const { audio } = await req.json();

    if (!audio || typeof audio !== "string") {
      return NextResponse.json({ error: "Аудиоданные отсутствуют." }, { status: 400 });
    }

    const base64 = audio.includes(",") ? audio.split(",")[1] : audio;

    const zai = await ZAI.create();
    const response = await zai.audio.asr.create({
      file_base64: base64,
    });

    return NextResponse.json({
      text: (response.text || "").trim(),
    });
  } catch (error) {
    console.error("JARVIS ASR error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Распознавание речи недоступно." },
      { status: 500 }
    );
  }
}
