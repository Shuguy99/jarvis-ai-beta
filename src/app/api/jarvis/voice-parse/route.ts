import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";

const SYSTEM_PROMPT = `Ты парсер голосовых команд для JARVIS AI. Проанализируй текст и верни JSON с intent и params. Возможные intents: open_widget, set_timer, toggle_theme, toggle_fullscreen, new_chat, capture_screen, toggle_notes, toggle_voice, search_web, get_weather, get_time, system_status, ask_question. Если не можешь определить intent, используй 'ask_question'. Верни ТОЛЬКО JSON без markdown: {"intent": "...", "params": {}}`;

interface VoiceParseRequest {
  text: string;
}

interface VoiceParseResponse {
  intent: string;
  params: Record<string, string>;
  confidence: number;
}

function stripMarkdownFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
  }
  return cleaned.trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as VoiceParseRequest;
    const { text } = body;

    if (!text || !text.trim()) {
      return json({ error: "Пустой текст." }, 400);
    }

    if (text.length >= 100) {
      return json<VoiceParseResponse>({
        intent: "ask_question",
        params: {},
        confidence: 0.3,
      });
    }

    const reply = await ai.chat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.trim() },
      ],
      { temperature: 0.1, maxTokens: 256 }
    );

    const cleaned = stripMarkdownFences(reply.content);

    let parsed: { intent?: string; params?: Record<string, string> };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return json<VoiceParseResponse>({
        intent: "ask_question",
        params: {},
        confidence: 0.2,
      });
    }

    const validIntents = new Set([
      "open_widget", "set_timer", "toggle_theme", "toggle_fullscreen",
      "new_chat", "capture_screen", "toggle_notes", "toggle_voice",
      "search_web", "get_weather", "get_time", "system_status", "ask_question",
    ]);

    const intent = parsed.intent && validIntents.has(parsed.intent)
      ? parsed.intent
      : "ask_question";

    const params = parsed.params && typeof parsed.params === "object"
      ? parsed.params
      : {};

    return json<VoiceParseResponse>({
      intent,
      params,
      confidence: intent === "ask_question" ? 0.3 : 0.7,
    });
  } catch (error) {
    console.error("[voice-parse] Error:", error);
    return json({ error: "Не удалось обработать запрос." }, 500);
  }
}