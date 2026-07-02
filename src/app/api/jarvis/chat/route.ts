import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";
import { buildChatMessages, JARVIS_SYSTEM_PROMPT } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: ChatMessage[];
  query: string;
  search?: boolean;
  stream?: boolean;
}

/**
 * Decide whether a query needs fresh web info.
 * Lightweight heuristic to keep latency low for chit-chat.
 */
function needsWebSearch(query: string): boolean {
  const q = query.toLowerCase();
  const triggers = [
    "сегодня", "сейчас", "новости", "новост", "погод", "курс", "цена", "акци",
    "latest", "today", "now", "news", "weather", "price", "stock", "current",
    "кто победил", "результат", "score", "release", "вышл", "обнов",
    "найди", "find", "search", "поиск", "google",
  ];
  return triggers.some((t) => q.includes(t));
}

function formatSearchContext(results: { name: string; url: string; snippet: string; host_name?: string; date?: string }[]): string {
  return results
    .slice(0, 6)
    .map((r, i) => `${i + 1}. ${r.name}\n${r.snippet}\nИсточник: ${r.host_name ?? ""} (${r.url})`)
    .join("\n\n");
}

function isOpenAIProvider(): boolean {
  return process.env.AI_PROVIDER?.toLowerCase() !== "zai";
}

function getOpenAIConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    visionModel: process.env.OPENAI_VISION_MODEL || "gpt-4o",
    imageModel: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { messages = [], query, stream } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Пустой запрос." }, { status: 400 });
    }

    let searchContext: string | undefined;
    let sources: { name: string; url: string; host_name?: string }[] | undefined;
    let searched = false;

    const shouldSearch = body.search === true || needsWebSearch(query);
    if (shouldSearch && ai.isSearchAvailable()) {
      try {
        const results = await ai.search(query, 6);
        if (results.length > 0) {
          searchContext = formatSearchContext(results);
          sources = results.map((r) => ({
            name: r.name,
            url: r.url,
            host_name: r.host_name,
          }));
          searched = true;
        }
      } catch (e) {
        console.error("JARVIS search error:", e);
      }
    }

    const history: ChatMessage[] = [...messages, {
      id: "tmp",
      role: "user",
      content: query,
      createdAt: new Date().toISOString(),
    }];

    const llmMessages = buildChatMessages(history, { searchContext });

    // ─── Streaming mode ───
    if (stream === true) {
      return handleStream(llmMessages, searched, sources);
    }

    // ─── Non-streaming mode (original) ───
    const reply = (await ai.chat(llmMessages)).content;

    return NextResponse.json({
      reply,
      sources: searched ? sources : undefined,
      searched,
      provider: ai.getProviderName(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("JARVIS chat error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Внутренняя ошибка J.A.R.V.I.S." },
      { status: 500 }
    );
  }
}

/**
 * SSE streaming handler.
 * For OpenAI: streams SSE chunks directly from the API.
 * For ZAI: falls back to non-streaming, sends full response as single chunk.
 */
function handleStream(
  llmMessages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[],
  searched: boolean,
  sources: { name: string; url: string; host_name?: string }[] | undefined,
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Try OpenAI streaming
        if (isOpenAIProvider()) {
          const cfg = getOpenAIConfig();
          if (!cfg.apiKey) {
            // No API key — send demo message
            const fallback = "» Сэр, для работы чата необходим API-ключ OpenAI. Пожалуйста, задайте переменную OPENAI_API_KEY в файле .env";
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: fallback })}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const apiBody: Record<string, unknown> = {
            model: cfg.model,
            messages: llmMessages,
            max_tokens: 2048,
            temperature: 0.7,
            stream: true,
          };

          const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${cfg.apiKey}`,
            },
            body: JSON.stringify(apiBody),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`OpenAI API error (${res.status}): ${errText}`);
          }

          const reader = res.body?.getReader();
          if (!reader) throw new Error("No response body for streaming");

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            // Keep the last (potentially incomplete) line in buffer
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;

              if (trimmed === "data: [DONE]") {
                // Send metadata then done
                if (searched && sources) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`));
                }
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }

              if (trimmed.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`)
                    );
                  }
                } catch {
                  // Skip malformed JSON chunks
                }
              }
            }
          }

          // Stream ended without [DONE]
          if (searched && sources) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } else {
          // ZAI provider — fall back to non-streaming, wrap full response as single chunk
          const reply = (await ai.chat(llmMessages as any)).content;

          // Send as single chunk
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ content: reply })}\n\n`)
          );

          if (searched && sources) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ sources })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Streaming error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
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