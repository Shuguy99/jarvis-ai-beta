import { ai } from "@/lib/ai-provider";
import type { ContentPart, LLMMessage } from "@/lib/ai-provider";
import { buildChatMessages } from "@/lib/jarvis";
import type { BehaviorSettings } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";
import { parseJsonBody, MAX_BODY_BYTES_CHAT, BodyLimitError } from "@/lib/body-limit";
import { injectRAGIntoSystemPrompt } from "@/lib/rag-context";

interface StreamRequestBody {
  messages: ChatMessage[];
  query: string;
  behavior?: Partial<BehaviorSettings>;
  imageBase64?: string;
  voicePersonaId?: string;
  memoryContext?: string;
  ragContext?: string;
}

export async function POST(req: Request) {
  try {
    const body = await parseJsonBody<StreamRequestBody>(req, MAX_BODY_BYTES_CHAT);
    const { messages = [], query, behavior, imageBase64, voicePersonaId, memoryContext, ragContext: clientRAGContext } = body;

    if (!query || !query.trim()) {
      return new Response(JSON.stringify({ error: "Пустой запрос." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
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

    // Inject memory context into system prompt
    if (memoryContext && llmMessages.length > 0 && typeof llmMessages[0].content === "string") {
      llmMessages[0] = { ...llmMessages[0], content: llmMessages[0].content + "\n\n" + memoryContext };
    }

    // Inject client-side RAG context (IndexedDB TF-IDF) after memory context
    if (clientRAGContext && llmMessages.length > 0 && typeof llmMessages[0].content === "string") {
      llmMessages[0] = { ...llmMessages[0], content: llmMessages[0].content + "\n\nRelevant document context:\n" + clientRAGContext };
    }

    const systemContent = typeof llmMessages[0]?.content === "string" ? llmMessages[0].content : "";
    const { prompt: ragPrompt, context: ragContext } = await injectRAGIntoSystemPrompt(
      systemContent,
      query
    );
    if (ragContext.hasContext && llmMessages.length > 0 && typeof llmMessages[0].content === "string") {
      llmMessages[0] = { ...llmMessages[0], content: ragPrompt };
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of ai.chatStream(llmMessages, {
            temperature: behavior?.temperature,
            maxTokens: behavior?.maxTokens,
          })) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          let msg = error instanceof Error ? error.message : "Stream error";
          if (msg.includes("OLLAMA_UNAVAILABLE")) {
            msg = "Сервер Ollama не запущен. Запустите Ollama и загрузите модель:\nollama pull llama3.1";
          } else if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
            msg = "Сервер Ollama не запущен. Запустите Ollama и загрузите модель:\nollama pull llama3.1";
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 413, headers: { "Content-Type": "application/json" },
      });
    }
    const msg = error instanceof Error ? error.message : "Stream error";

    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed") || msg.includes("connect")) {
      return new Response(
        JSON.stringify({
          error: "Ollama не запущен. Запустите Ollama и загрузите модель: ollama pull llama3.1",
          ollamaNotRunning: true,
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}