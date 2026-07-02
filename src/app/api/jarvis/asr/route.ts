import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/asr
 *
 * В локальном режиме (Ollama) распознавание речи обрабатывается
 * в браузере через Web Speech API (SpeechRecognition).
 */
export async function POST() {
  return NextResponse.json({
    useBrowserASR: true,
    message: "Browser ASR (SpeechRecognition) is used in local mode.",
  });
}