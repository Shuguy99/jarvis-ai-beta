import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/search
 * Body: { query, num? }
 * Returns: { results: [...], available: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const { query, num = 8 } = await req.json();

    if (!query || typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Пустой поисковый запрос." }, { status: 400 });
    }

    const results = await ai.search(query, Math.min(Math.max(num, 1), 20));

    return NextResponse.json({
      results,
      available: true,
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