import { json } from "@/lib/json-response";
import { ai } from "@/lib/ai-provider";
import type { AIProviderType } from "@/lib/ai-provider";

const PROVIDER_CATALOG: Array<{
  id: AIProviderType;
  name: string;
  envKeys: string[];
  defaultModel: string;
  supports: { chat: boolean; vision: boolean; imageGen: boolean };
}> = [
  { id: "ollama", name: "Ollama (Local AI)", envKeys: [], defaultModel: "llama3.1", supports: { chat: true, vision: true, imageGen: false } },
  { id: "openai", name: "OpenAI", envKeys: ["OPENAI_API_KEY"], defaultModel: "gpt-4o-mini", supports: { chat: true, vision: true, imageGen: true } },
  { id: "anthropic", name: "Anthropic", envKeys: ["ANTHROPIC_API_KEY"], defaultModel: "claude-sonnet-4-20250514", supports: { chat: true, vision: true, imageGen: false } },
  { id: "gemini", name: "Google Gemini", envKeys: ["GEMINI_API_KEY"], defaultModel: "gemini-2.5-flash", supports: { chat: true, vision: true, imageGen: false } },
  { id: "openrouter", name: "OpenRouter", envKeys: ["OPENROUTER_API_KEY"], defaultModel: "google/gemini-2.5-flash-preview:free", supports: { chat: true, vision: true, imageGen: false } },
];

export async function GET() {
  try {
    const available = ai.getAvailableProviders();
    const active = await ai.getActiveProviderInfo();

    const catalog = PROVIDER_CATALOG.map((p) => ({
      ...p,
      configured: available.some((a) => a.id === p.id),
    }));

    return json({ catalog, active });
  } catch (error) {
    console.error("Failed to load providers:", error);
    return json({ error: "Failed to load providers" }, 500);
  }
}