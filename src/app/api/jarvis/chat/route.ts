import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";
import { buildChatMessages, buildSystemPrompt } from "@/lib/jarvis";
import type { BehaviorSettings } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";
import { parseJsonBody, MAX_BODY_BYTES_CHAT, BodyLimitError } from "@/lib/body-limit";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: ChatMessage[];
  query: string;
  search?: boolean;
  behavior?: Partial<BehaviorSettings>;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed, retryAfterMs } = checkRateLimit(ip, 30, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Rate limit exceeded", retryAfterMs }, {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const body = await parseJsonBody<ChatRequestBody>(req, MAX_BODY_BYTES_CHAT);
    const { messages = [], query, behavior } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Пустой запрос." }, { status: 400 });
    }

    const history: ChatMessage[] = [...messages, {
      id: "tmp",
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    }];

    const llmMessages = buildChatMessages(history, { behavior });

    // Pass temperature and maxTokens to the AI provider if supported
    const reply = await ai.chat(llmMessages, {
      temperature: behavior?.temperature,
      maxTokens: behavior?.maxTokens,
    });

    return NextResponse.json({
      reply: reply.content,
      provider: ai.getProviderName(),
      timestamp: new Date().toISOString(),
      promptPreview: buildSystemPrompt(behavior ?? {}).slice(0, 80) + "...",
    });
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    console.error("JARVIS chat error:", error);

    const msg = error instanceof Error ? error.message : "Внутренняя ошибка J.A.R.V.I.S.";

    // Detect connection errors (provider unavailable)
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("connect") || msg.includes("UNAVAILABLE")) {
      return NextResponse.json(
        {
          error: msg.includes("Ollama") ? "Сервер Ollama не запущен. Запустите Ollama и загрузите модель." : msg,
          providerUnavailable: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    const providerInfo = await ai.getActiveProviderInfo();
    return NextResponse.json({
      name: "J.A.R.V.I.S.",
      online: true,
      provider: providerInfo.name,
      providerId: providerInfo.id,
      chatAvailable: providerInfo.chatAvailable,
      visionAvailable: providerInfo.visionAvailable,
      imageGenAvailable: providerInfo.imageGenAvailable,
      searchAvailable: providerInfo.searchAvailable,
    });
  } catch {
    // Fallback if settings endpoint is down
    return NextResponse.json({
      name: "J.A.R.V.I.S.",
      online: true,
      provider: ai.getProviderName(),
      chatAvailable: ai.isChatAvailable(),
      searchAvailable: ai.isSearchAvailable(),
    });
  }
}