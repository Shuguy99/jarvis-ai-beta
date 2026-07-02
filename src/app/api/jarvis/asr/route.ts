import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/asr
 * Body: { audio: base64string }
 * Returns: { text } or { useBrowserASR: true } for local mode
 *
 * NOTE: For local PC use, ASR is handled in the browser via
 * the Web Speech API (SpeechRecognition). This endpoint is kept
 * for cloud/ZAI mode.
 */
export async function POST(req: NextRequest) {
  try {
    const provider = process.env.AI_PROVIDER?.toLowerCase();
    if (provider !== "zai") {
      // Local mode — browser should use SpeechRecognition API directly
      return NextResponse.json({
        useBrowserASR: true,
        message: "Browser ASR (Web Speech API) is used in local mode. No server-side processing needed.",
      });
    }

    // ZAI cloud mode
    const { audio } = await req.json();

    if (!audio || typeof audio !== "string") {
      return NextResponse.json({ error: "Аудиоданные отсутствуют." }, { status: 400 });
    }

    const base64 = audio.includes(",") ? audio.split(",")[1] : audio;

    const ZAI = (await import("z-ai-web-dev-sdk")).default;
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