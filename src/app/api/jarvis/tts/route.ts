import { json } from "@/lib/json-response";

export async function POST() {
  return json({
    useBrowserTTS: true,
    message: "Browser TTS (SpeechSynthesis) is used in local mode.",
  });
}