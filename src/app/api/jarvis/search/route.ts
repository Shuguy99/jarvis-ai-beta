import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/search
 * Body: { query, num? }
 * Returns: { results: [...] }
 */
export async function POST(req: NextRequest) {
  try {
    const { query, num = 8 } = await req.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Пустой поисковый запрос." }, { status: 400 });
    }

    const zai = await ZAI.create();
    const results = (await zai.functions.invoke("web_search", {
      query,
      num: Math.min(Math.max(num, 1), 20),
    })) as {
      url: string;
      name: string;
      snippet: string;
      host_name?: string;
      rank?: number;
      date?: string;
      favicon?: string;
    }[];

    return NextResponse.json({
      results: Array.isArray(results) ? results : [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("JARVIS search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Веб-поиск недоступен." },
      { status: 500 }
    );
  }
}
