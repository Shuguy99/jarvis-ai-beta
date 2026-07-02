import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/tts
 *
 * В локальном режиме (Ollama) TTS обрабатывается полностью в браузере
 * через Web Speech API (SpeechSynthesis). Этот endpoint возвращает
 * инструкцию использовать браузерный TTS.
 */
export async function POST() {
  return NextResponse.json({
    useBrowserTTS: true,
    message: "Browser TTS (SpeechSynthesis) is used in local mode.",
  });
}