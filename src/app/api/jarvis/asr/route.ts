import { json } from "@/lib/json-response";

export async function POST() {
  return json({
    useBrowserASR: true,
    message: "Browser ASR (SpeechRecognition) is used in local mode.",
  });
}