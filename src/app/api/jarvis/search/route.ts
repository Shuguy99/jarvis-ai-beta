import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";

export async function POST(req: Request) {
  try {
    return json({
      results: [],
      available: ai.isSearchAvailable(),
      message: "Веб-поиск недоступен в локальном режиме (Ollama). Установите SearXNG или подключите поисковый API для включения.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Search failed:", error);
    return json({ error: "Search failed" }, 500);
  }
}