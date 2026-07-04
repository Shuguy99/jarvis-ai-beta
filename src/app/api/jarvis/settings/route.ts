import { json } from "@/lib/json-response";
import { db } from "@/lib/db";

const VALID_KEYS = [
  "ttsRate", "ttsPitch", "volume", "autoSpeak", "language",
  "persona", "userName", "formality", "humor", "responseStyle",
  "temperature", "maxTokens", "contextWindow", "customPrompt",
  "aiProvider", "openaiApiKey", "openaiModel", "anthropicApiKey",
  "anthropicModel", "ollamaModel", "ollamaVisionModel",
];

const DEFAULTS: Record<string, string> = {
  ttsRate: "1.05", ttsPitch: "0.95", volume: "1.0", autoSpeak: "true", language: "ru",
  persona: "classic", userName: "", formality: "0.7", humor: "0.4",
  responseStyle: "standard", temperature: "0.7", maxTokens: "2048",
  contextWindow: "20", customPrompt: "",
  aiProvider: "ollama", openaiApiKey: "", openaiModel: "gpt-4o-mini",
  anthropicApiKey: "", anthropicModel: "claude-sonnet-4-20250514",
  ollamaModel: "llama3.1", ollamaVisionModel: "llava",
};

export async function GET() {
  try {
    const rows = await db.setting.findMany({ select: { key: true, value: true } });
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const settings: Record<string, string> = {};
    for (const key of VALID_KEYS) {
      settings[key] = stored.get(key) ?? DEFAULTS[key] ?? "";
    }
    return json({ settings });
  } catch (error) {
    console.error("JARVIS settings GET error:", error);
    return json({ error: "Failed to load settings" }, 500);
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const incoming = body.settings as Record<string, string> | undefined;

    if (!incoming || typeof incoming !== "object") {
      return json({ error: "Body must contain { settings: { key: value, ... } }" }, 400);
    }

    for (const key of Object.keys(incoming)) {
      if (!VALID_KEYS.includes(key)) {
        return json({ error: `Invalid setting key: ${key}` }, 400);
      }
    }

    for (const [key, value] of Object.entries(incoming)) {
      await db.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return json({ success: true });
  } catch (error) {
    console.error("JARVIS settings PUT error:", error);
    return json({ error: "Failed to save settings" }, 500);
  }
}