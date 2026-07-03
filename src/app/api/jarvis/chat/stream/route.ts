import type { NextRequest } from "next/server";
import { ai } from "@/lib/ai-provider";
import { buildChatMessages } from "@/lib/jarvis";
import type { BehaviorSettings } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";
import { parseJsonBody, MAX_BODY_BYTES_CHAT, BodyLimitError } from "@/lib/body-limit";

export const runtime = "nodejs";

interface StreamRequestBody {
  messages: ChatMessage[];
  query: string;
  behavior?: Partial<BehaviorSettings>;
}

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<StreamRequestBody>(req, MAX_BODY_BYTES_CHAT);
    const { messages = [], query, behavior } = body;

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

    const llmMessages = buildChatMessages(history, { behavior });

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
          // Translate Ollama connection errors to user-friendly message
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