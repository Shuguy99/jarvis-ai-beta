import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";
import type { ContentPart, LLMMessage } from "@/lib/ai-provider";
import { buildChatMessages, buildSystemPrompt } from "@/lib/jarvis";
import type { BehaviorSettings } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";
import { parseJsonBody, MAX_BODY_BYTES_CHAT, BodyLimitError } from "@/lib/body-limit";

interface ChatRequestBody {
  messages: ChatMessage[];
  query: string;
  search?: boolean;
  behavior?: Partial<BehaviorSettings>;
  imageBase64?: string;
  voicePersonaId?: string;
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody<ChatRequestBody>(req, MAX_BODY_BYTES_CHAT);
    const { messages = [], query, behavior, imageBase64, voicePersonaId } = body;

    if (!query || !query.trim()) {
      return json({ error: "Пустой запрос." }, 400);
    }

    const history: ChatMessage[] = [...messages, {
      id: "tmp",
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    }];

    const llmMessages: LLMMessage[] = buildChatMessages(history, { behavior, voicePersonaId });

    // Мультимодальный запрос: текст + изображение в последнем сообщении пользователя
    if (imageBase64) {
      const imageUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`;
      const lastUserIdx = llmMessages.map((m) => m.role).lastIndexOf("user");
      if (lastUserIdx >= 0) {
        const prevContent = typeof llmMessages[lastUserIdx].content === "string"
          ? llmMessages[lastUserIdx].content
          : "";
        const parts: ContentPart[] = [
          { type: "text", text: prevContent },
          { type: "image_url", image_url: { url: imageUrl } },
        ];
        llmMessages[lastUserIdx] = { ...llmMessages[lastUserIdx], content: parts };
      }
    }

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