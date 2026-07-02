import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";
import { buildChatMessages, JARVIS_SYSTEM_PROMPT } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: ChatMessage[];
  query: string;
  search?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { messages = [], query } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Пустой запрос." }, { status: 400 });
    }

    const history: ChatMessage[] = [...messages, {
      id: "tmp",
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    }];

    const llmMessages = buildChatMessages(history);

    const reply = (await ai.chat(llmMessages)).content;

    return NextResponse.json({
      reply,
      provider: ai.getProviderName(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("JARVIS chat error:", error);

    const msg = error instanceof Error ? error.message : "Внутренняя ошибка J.A.R.V.I.S.";

    // Detect Ollama not running
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("connect")) {
      return NextResponse.json(
        {
          error: "Ollama не запущен. Запустите Ollama (ollama.com) и убедитесь, что модель загружена: ollama pull llama3.1",
          ollamaNotRunning: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: "J.A.R.V.I.S.",
    system: JARVIS_SYSTEM_PROMPT.slice(0, 120),
    online: true,
    provider: ai.getProviderName(),
    chatAvailable: ai.isChatAvailable(),
    searchAvailable: ai.isSearchAvailable(),
  });
}