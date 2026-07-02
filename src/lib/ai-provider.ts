/**
 * AI Provider — Ollama (local LLM, no API key needed)
 *
 * Requires Ollama running locally: https://ollama.com
 * Default: http://localhost:11434/v1 (OpenAI-compatible API)
 *
 * Environment variables (all optional):
 *   OLLAMA_BASE_URL  — Ollama API base URL (default: http://localhost:11434/v1)
 *   OLLAMA_MODEL     — Chat model name (default: llama3.1)
 *   OLLAMA_VISION_MODEL — Vision model (default: llava)
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

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
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

// ─── Config ─────────────────────────────────────────────────────

function getConfig() {
  return {
    baseUrl: (process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, ""),
    model: process.env.OLLAMA_MODEL || "llama3.1",
    visionModel: process.env.OLLAMA_VISION_MODEL || "llava",
  };
}

// ─── Ollama Chat (OpenAI-compatible) ────────────────────────────

async function ollamaChat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
  const cfg = getConfig();

  const body = {
    model: cfg.model,
    messages: messages.map((m) => {
      if (typeof m.content === "string") return { role: m.role, content: m.content };
      return { role: m.role, content: m.content };
    }),
    max_tokens: opts?.maxTokens ?? 2048,
    temperature: opts?.temperature ?? 0.7,
    stream: false,
  };

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from Ollama");
  return { content };
}

// ─── Ollama Vision ──────────────────────────────────────────────

async function ollamaVision(imageBase64: string, prompt: string): Promise<LLMResponse> {
  const cfg = getConfig();
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
    stream: false,
  };

  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama vision error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from vision model");
  return { content };
}

// ─── Unified API ─────────────────────────────────────────────────

export const ai = {
  /** Send messages to the LLM and get a response */
  async chat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
    return ollamaChat(messages, opts);
  },

  /** Analyze an image with a vision model */
  async vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    return ollamaVision(imageBase64, prompt);
  },

  /** Generate an image — not supported by Ollama */
  async imageGen(_prompt: string, _size?: string): Promise<ImageGenResult> {
    throw new Error(
      "Генерация изображений недоступна с Ollama. Для генерации изображений требуется подключение к сервису с поддержкой DALL-E/Stable Diffusion."
    );
  },

  /** Web search — not available locally without external API */
  async search(_query: string, _num?: number): Promise<SearchResult[]> {
    return [];
  },

  isChatAvailable(): boolean {
    return true;
  },

  isVisionAvailable(): boolean {
    return true;
  },

  isImageGenAvailable(): boolean {
    return false;
  },

  isSearchAvailable(): boolean {
    return false;
  },

  getProviderName(): string {
    return "Ollama (Local AI)";
  },
};