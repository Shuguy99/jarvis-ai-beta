import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";

export const runtime = "nodejs";

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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as VoiceParseRequest;
    const { text } = body;

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: "Пустой текст." },
        { status: 400 }
      );
    }

    // If text is long, likely not a voice command — return ask_question
    if (text.length >= 100) {
      return NextResponse.json<VoiceParseResponse>({
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
      return NextResponse.json<VoiceParseResponse>({
        intent: "ask_question",
        params: {},
        confidence: 0.2,
      });
    }

    const validIntents = new Set([
      "open_widget",
      "set_timer",
      "toggle_theme",
      "toggle_fullscreen",
      "new_chat",
      "capture_screen",
      "toggle_notes",
      "toggle_voice",
      "search_web",
      "get_weather",
      "get_time",
      "system_status",
      "ask_question",
    ]);

    const intent = parsed.intent && validIntents.has(parsed.intent)
      ? parsed.intent
      : "ask_question";

    const params = parsed.params && typeof parsed.params === "object"
      ? parsed.params
      : {};

    return NextResponse.json<VoiceParseResponse>({
      intent,
      params,
      confidence: intent === "ask_question" ? 0.3 : 0.7,
    });
  } catch (error) {
    console.error("[voice-parse] Error:", error);
    return NextResponse.json(
      { error: "Не удалось обработать запрос." },
      { status: 500 }
    );
  }
}