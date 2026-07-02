import { NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({
    results: [],
    available: ai.isSearchAvailable(),
    message: "Веб-поиск недоступен в локальном режиме (Ollama). Установите SearXNG или подключите поисковый API для включения.",
    timestamp: new Date().toISOString(),
  });
}