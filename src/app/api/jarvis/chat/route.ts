import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";
import { buildChatMessages, buildSystemPrompt } from "@/lib/jarvis";
import type { BehaviorSettings } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";
import { parseJsonBody, MAX_BODY_BYTES_CHAT, BodyLimitError } from "@/lib/body-limit";
import { checkRateLimit } from "@/lib/rate-limit";

interface ChatRequestBody {
  messages: ChatMessage[];
  query: string;
  search?: boolean;
  behavior?: Partial<BehaviorSettings>;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed, retryAfterMs } = checkRateLimit(ip, 30, 60_000);
    if (!allowed) {
      return json({ error: "Rate limit exceeded", retryAfterMs }, {
        status: 429,
        headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) },
      });
    }

    const body = await parseJsonBody<ChatRequestBody>(req, MAX_BODY_BYTES_CHAT);
    const { messages = [], query, behavior } = body;

    if (!query || !query.trim()) {
      return json({ error: "Пустой запрос." }, 400);
    }

    const history: ChatMessage[] = [...messages, {
      id: "tmp",
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    }];

    const llmMessages = buildChatMessages(history, { behavior });

    const reply = await ai.chat(llmMessages, {
      temperature: behavior?.temperature,
      maxTokens: behavior?.maxTokens,
    });

    return json({
      reply: reply.content,
      provider: ai.getProviderName(),
      timestamp: new Date().toISOString(),
      promptPreview: buildSystemPrompt(behavior ?? {}).slice(0, 80) + "...",
    });
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return json({ error: error.message }, 413);
    }
    console.error("JARVIS chat error:", error);

    const msg = error instanceof Error ? error.message : "Внутренняя ошибка J.A.R.V.I.S.";

    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("connect") || msg.includes("UNAVAILABLE")) {
      return json(
        {
          error: msg.includes("Ollama") ? "Сервер Ollama не запущен. Запустите Ollama и загрузите модель." : msg,
          providerUnavailable: true,
        },
        503,
      );
    }

    return json({ error: msg }, 500);
  }
}

export async function GET() {
  try {
    const providerInfo = await ai.getActiveProviderInfo();
    return json({
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
    return json({
      name: "J.A.R.V.I.S.",
      online: true,
      provider: ai.getProviderName(),
      chatAvailable: ai.isChatAvailable(),
      searchAvailable: ai.isSearchAvailable(),
    });
  }
}