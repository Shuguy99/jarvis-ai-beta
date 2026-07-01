import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/tts
 * Body: { text, voice?, speed? }
 * Returns: audio/wav binary
 */
export async function POST(req: NextRequest) {
  try {
    const { text, voice = "tongtong", speed = 1.0 } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Текст пуст." }, { status: 400 });
    }

    const clean = text.replace(/\s+/g, " ").trim().slice(0, 1000);

    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({
      input: clean,
      voice,
      speed,
      response_format: "wav",
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("JARVIS TTS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Синтез речи недоступен." },
      { status: 500 }
    );
  }
}
