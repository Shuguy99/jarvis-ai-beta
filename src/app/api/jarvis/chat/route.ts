import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { buildChatMessages, JARVIS_SYSTEM_PROMPT } from "@/lib/jarvis";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: ChatMessage[];
  query: string;
  search?: boolean;
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

function formatSearchContext(
  results: { name: string; url: string; snippet: string; host_name?: string; date?: string }[]
): string {
  return results
    .slice(0, 6)
    .map((r, i) => `${i + 1}. ${r.name}\n${r.snippet}\nИсточник: ${r.host_name ?? ""} (${r.url})`)
    .join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const { messages = [], query } = body;

    if (!query || !query.trim()) {
      return NextResponse.json({ error: "Пустой запрос." }, { status: 400 });
    }

    const zai = await ZAI.create();

    let searchContext: string | undefined;
    let sources: { name: string; url: string; host_name?: string }[] | undefined;
    let searched = false;

    const shouldSearch = body.search === true || needsWebSearch(query);
    if (shouldSearch) {
      try {
        const results = (await zai.functions.invoke("web_search", {
          query,
          num: 6,
        })) as { name: string; url: string; snippet: string; host_name?: string; date?: string }[];
        if (Array.isArray(results) && results.length > 0) {
          searchContext = formatSearchContext(results);
          sources = results.slice(0, 6).map((r) => ({
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

    const completion = await zai.chat.completions.create({
      messages: llmMessages,
      thinking: { type: "disabled" },
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "» Не удалось сформировать ответ. Повторите запрос, сэр.";

    return NextResponse.json({
      reply,
      sources: searched ? sources : undefined,
      searched,
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

export async function GET() {
  return NextResponse.json({
    name: "J.A.R.V.I.S.",
    system: JARVIS_SYSTEM_PROMPT.slice(0, 120),
    online: true,
  });
}
