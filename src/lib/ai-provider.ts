/**
 * AI Provider Abstraction Layer
 *
 * Supports multiple backends:
 * - "openai" — OpenAI-compatible API (default for local PC use)
 * - "zai"    — z-ai-web-dev-sdk (cloud/sandbox environment)
 *
 * Environment variables:
 *   AI_PROVIDER        — "openai" | "zai" (default: "openai")
 *   OPENAI_API_KEY     — API key for OpenAI or compatible service
 *   OPENAI_BASE_URL    — Custom base URL (e.g. http://localhost:11434/v1 for Ollama)
 *   OPENAI_MODEL       — Chat model name (default: "gpt-4o-mini")
 *   OPENAI_VISION_MODEL — Vision model name (default: "gpt-4o")
 *   SEARCH_PROVIDER    — "google" | "bing" | "serpapi" | "none" (default: "none")
 *   SEARCH_API_KEY     — API key for web search (if enabled)
 *   SEARCH_ENGINE_ID   — Google Custom Search Engine ID (if using Google)
 */

// ─── Types ───────────────────────────────────────────────────────

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

export interface LLMResponse {
  content: string;
}

export interface SearchResult {
  name: string;
  url: string;
  snippet: string;
  host_name?: string;
  date?: string;
}

export interface ImageGenResult {
  base64: string;
  revisedPrompt?: string;
}

// ─── Provider Detection ──────────────────────────────────────────

function getProvider(): "openai" | "zai" {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === "zai") return "zai";
  return "openai";
}

function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// ─── OpenAI-compatible Provider ─────────────────────────────────

function getOpenAIConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    visionModel: process.env.OPENAI_VISION_MODEL || "gpt-4o",
    imageModel: process.env.OPENAI_IMAGE_MODEL || "dall-e-3",
  };
}

async function openaiChat(messages: LLMMessage[]): Promise<LLMResponse> {
  const cfg = getOpenAIConfig();

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages: messages.map((m) => {
      if (typeof m.content === "string") return { role: m.role, content: m.content };
      return { role: m.role, content: m.content };
    }),
    max_tokens: 2048,
    temperature: 0.7,
  };

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from LLM");
  return { content };
}

async function openaiVision(imageBase64: string, prompt: string): Promise<LLMResponse> {
  const cfg = getOpenAIConfig();
  const imageUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const body = {
    model: cfg.visionModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    max_tokens: 2048,
  };

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from vision model");
  return { content };
}

async function openaiImageGen(prompt: string, size: string): Promise<ImageGenResult> {
  const cfg = getOpenAIConfig();

  const body = {
    model: cfg.imageModel,
    prompt: prompt.trim(),
    n: 1,
    size: size || "1024x1024",
    response_format: "b64_json",
  };

  const res = await fetch(`${cfg.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    const msg = JSON.parse(err)?.error?.message || err;
    if (msg.includes("content") || msg.includes("policy") || msg.includes("safety")) {
      throw new Error("Prompt blocked by content policy. Please rephrase.");
    }
    throw new Error(`Image generation error (${res.status}): ${msg}`);
  }

  const data = await res.json();
  const img = data.data?.[0];
  if (!img?.b64_json) throw new Error("Image generation returned no data");

  return {
    base64: img.b64_json,
    revisedPrompt: img.revised_prompt,
  };
}

// ─── Web Search ──────────────────────────────────────────────────

async function searchGoogle(query: string, num: number): Promise<SearchResult[]> {
  const apiKey = process.env.SEARCH_API_KEY;
  const engineId = process.env.SEARCH_ENGINE_ID;
  if (!apiKey || !engineId) throw new Error("Google search not configured (missing SEARCH_API_KEY or SEARCH_ENGINE_ID)");

  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}&num=${num}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Search API error: ${res.status}`);

  const data = await res.json();
  return (data.items || []).slice(0, num).map((item: Record<string, string>) => ({
    name: item.title || "",
    url: item.link || "",
    snippet: item.snippet || "",
    host_name: new URL(item.link || "https://example.com").hostname,
  }));
}

// ─── ZAI Provider (cloud/sandbox) ───────────────────────────────

async function zaiChat(messages: LLMMessage[]): Promise<LLMResponse> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const completion = await zai.chat.completions.create({
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    thinking: { type: "disabled" },
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from ZAI");
  return { content };
}

async function zaiVision(imageBase64: string, prompt: string): Promise<LLMResponse> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const imageUrl = imageBase64.startsWith("data:")
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  const response = await zai.chat.completions.createVision({
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });

  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from ZAI vision");
  return { content };
}

async function zaiSearch(query: string, num: number): Promise<SearchResult[]> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const results = (await zai.functions.invoke("web_search", { query, num })) as SearchResult[];
  return Array.isArray(results) ? results.slice(0, num) : [];
}

async function zaiImageGen(prompt: string, size: string): Promise<ImageGenResult> {
  const ZAI = (await import("z-ai-web-dev-sdk")).default;
  const zai = await ZAI.create();

  const response = await zai.images.generations.create({
    prompt: prompt.trim(),
    size: size || "1024x1024",
  });

  const base64 = response.data?.[0]?.base64;
  if (!base64) throw new Error("Image generation returned no data");
  return { base64 };
}

// ─── Unified API ─────────────────────────────────────────────────

export const ai = {
  /** Send messages to the LLM and get a response */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    const provider = getProvider();
    if (provider === "zai") return zaiChat(messages);
    if (!isOpenAIConfigured()) {
      return {
        content: "» Сэр, для работы чата необходим API-ключ OpenAI. Пожалуйста, задайте переменную OPENAI_API_KEY в файле .env\n\nИнструкции: https://github.com/Shuguy99/jarvis-ai-beta#setup",
      };
    }
    return openaiChat(messages);
  },

  /** Analyze an image with a vision model */
  async vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    const provider = getProvider();
    if (provider === "zai") return zaiVision(imageBase64, prompt);
    if (!isOpenAIConfigured()) {
      return { content: "» Анализ изображений недоступен. Задайте OPENAI_API_KEY в .env." };
    }
    return openaiVision(imageBase64, prompt);
  },

  /** Generate an image from a text prompt */
  async imageGen(prompt: string, size: string = "1024x1024"): Promise<ImageGenResult> {
    const provider = getProvider();
    if (provider === "zai") return zaiImageGen(prompt, size);
    if (!isOpenAIConfigured()) {
      throw new Error("Image generation requires OPENAI_API_KEY in .env");
    }
    return openaiImageGen(prompt, size);
  },

  /** Perform a web search (returns empty array if not configured) */
  async search(query: string, num: number = 6): Promise<SearchResult[]> {
    const provider = getProvider();
    const searchProvider = process.env.SEARCH_PROVIDER?.toLowerCase() || "none";

    // Cloud ZAI mode — always has search
    if (provider === "zai") return zaiSearch(query, num);

    // Local mode — check configuration
    if (searchProvider === "google") {
      return searchGoogle(query, num).catch((e) => {
        console.error("Search error:", e);
        return [];
      });
    }

    // No search configured
    return [];
  },

  /** Check if a specific feature is available */
  isChatAvailable(): boolean {
    const provider = getProvider();
    if (provider === "zai") return true;
    return isOpenAIConfigured();
  },

  isVisionAvailable(): boolean {
    return this.isChatAvailable();
  },

  isImageGenAvailable(): boolean {
    return this.isChatAvailable();
  },

  isSearchAvailable(): boolean {
    const provider = getProvider();
    if (provider === "zai") return true;
    const sp = process.env.SEARCH_PROVIDER?.toLowerCase() || "none";
    return sp !== "none";
  },

  getProviderName(): string {
    const provider = getProvider();
    if (provider === "zai") return "Z.ai Cloud";
    if (!isOpenAIConfigured()) return "Demo (no API key)";
    const baseUrl = process.env.OPENAI_BASE_URL || "";
    if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) return "Local LLM (Ollama)";
    return "OpenAI";
  },
};