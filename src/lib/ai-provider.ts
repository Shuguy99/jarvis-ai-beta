/**
 * AI Provider — Multi-provider strategy pattern
 *
 * Supports: Ollama (local), OpenAI, Anthropic, Google Gemini
 * Provider is selected via settings (aiProvider key) or env vars.
 * Falls back to Ollama if no provider is configured.
 *
 * Environment variables (optional, override settings):
 *   OLLAMA_BASE_URL   — Ollama API base URL (default: http://localhost:11434/v1)
 *   OLLAMA_MODEL       — Ollama chat model (default: llama3.1)
 *   OLLAMA_VISION_MODEL — Ollama vision model (default: llava)
 *   OPENAI_API_KEY     — OpenAI API key
 *   OPENAI_MODEL       — OpenAI model (default: gpt-4o-mini)
 *   ANTHROPIC_API_KEY  — Anthropic API key
 *   ANTHROPIC_MODEL    — Anthropic model (default: claude-sonnet-4-20250514)
 *   GEMINI_API_KEY     — Google Gemini API key
 *   GEMINI_MODEL       — Gemini model (default: gemini-2.5-flash)
 */

import { AI_CHAT_TIMEOUT_MS, AI_OTHER_TIMEOUT_MS } from "@/lib/api-timeout";

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

export type AIProviderType = "ollama" | "openai" | "anthropic" | "gemini" | "openrouter";

export interface ProviderInfo {
  id: AIProviderType;
  name: string;
  chatAvailable: boolean;
  visionAvailable: boolean;
  imageGenAvailable: boolean;
  searchAvailable: boolean;
}

// ─── Provider Settings Loader ──────────────────────────────────
// Server-side settings are cached for the lifetime of the process.
// In dev mode with HMR, this means per-request re-read.

let _cachedSettings: Record<string, string> | null = null;

async function getProviderSettings(): Promise<Record<string, string>> {
  if (_cachedSettings !== null) return _cachedSettings;
  try {
    const baseUrl = process.env.VITE_API_URL
      ? `${process.env.VITE_API_URL}/api/jarvis/settings`
      : "http://localhost:3001/api/jarvis/settings";
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      const settings: Record<string, string> = data.settings ?? {};
      _cachedSettings = settings;
      return settings;
    }
  } catch {
    // Settings endpoint unavailable — use env/defaults
  }
  return {};
}

// ─── Provider Implementations ──────────────────────────────────

/** Ollama provider — local, no API key */
function createOllamaProvider(settings: Record<string, string>) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, "");
  const model = process.env.OLLAMA_MODEL || settings.ollamaModel || "llama3.1";
  const visionModel = process.env.OLLAMA_VISION_MODEL || settings.ollamaVisionModel || "llava";

  async function chat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
    const body = {
      model,
      messages: messages.map((m) => (typeof m.content === "string"
        ? { role: m.role, content: m.content }
        : { role: m.role, content: m.content })),
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.7,
      stream: false,
    };

    const res = await ollamaFetch(`${baseUrl}/chat/completions`, body);
    return normalizeChatResponse(await res.json(), "openai", { errorContext: "Ollama" });
  }

  async function* chatStream(messages: LLMMessage[], opts?: LLMOptions): AsyncGenerator<string> {
    const body = {
      model,
      messages: messages.map((m) => (typeof m.content === "string"
        ? { role: m.role, content: m.content }
        : { role: m.role, content: m.content })),
      max_tokens: opts?.maxTokens ?? 2048,
      temperature: opts?.temperature ?? 0.7,
      stream: true,
    };

    const res = await ollamaFetch(`${baseUrl}/chat/completions`, body);
    yield* parseSSEStream(res);
  }

  async function vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const body = {
      model: visionModel,
      messages: [{
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      }],
      max_tokens: 2048,
      stream: false,
    };

    const res = await ollamaFetch(`${baseUrl}/chat/completions`, body);
    return normalizeChatResponse(await res.json(), "openai", { errorContext: "vision model" });
  }

  async function listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${baseUrl.replace(/\/v1$/, "")}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models ?? []).map((m: { name: string }) => m.name);
    } catch {
      return [];
    }
  }

  return {
    id: "ollama" as AIProviderType,
    name: "Ollama (Local AI)",
    chatAvailable: true,
    visionAvailable: true,
    imageGenAvailable: false,
    searchAvailable: false,
    chat,
    chatStream,
    vision,
    listModels,
  };
}

/** OpenAI provider — cloud, requires API key */
function createOpenAIProvider(settings: Record<string, string>) {
  const apiKey = process.env.OPENAI_API_KEY || settings.openaiApiKey;
  const model = process.env.OPENAI_MODEL || settings.openaiModel || "gpt-4o-mini";
  const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    // Return a stub that explains the issue
    const unavailable = () => { throw new Error("OPENAI_UNAVAILABLE: API key not configured. Set OPENAI_API_KEY env var or openaiApiKey in settings."); };
    return {
      id: "openai" as AIProviderType,
      name: "OpenAI",
      chatAvailable: false,
      visionAvailable: false,
      imageGenAvailable: false,
      searchAvailable: false,
      chat: unavailable,
      chatStream: unavailable,
      vision: unavailable,
    };
  }

  async function chat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
    const res = await timedFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.7,
        stream: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "openai", { throwOnEmpty: false });
  }

  async function* chatStream(messages: LLMMessage[], opts?: LLMOptions): AsyncGenerator<string> {
    const res = await timedFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI stream error (${res.status}): ${err}`);
    }
    yield* parseSSEStream(res);
  }

  async function vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const res = await timedFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model.includes("gpt-4o") ? model : "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        max_tokens: 2048,
      }),
    }, AI_OTHER_TIMEOUT_MS);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI vision error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "openai", { throwOnEmpty: false });
  }

  return {
    id: "openai" as AIProviderType,
    name: `OpenAI (${model})`,
    chatAvailable: true,
    visionAvailable: true,
    imageGenAvailable: true, // DALL-E available
    searchAvailable: false,
    chat,
    chatStream,
    vision,
  };
}

/** Anthropic provider — cloud, requires API key */
function createAnthropicProvider(settings: Record<string, string>) {
  const apiKey = process.env.ANTHROPIC_API_KEY || settings.anthropicApiKey;
  const model = process.env.ANTHROPIC_MODEL || settings.anthropicModel || "claude-sonnet-4-20250514";
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

  if (!apiKey) {
    const unavailable = () => { throw new Error("ANTHROPIC_UNAVAILABLE: API key not configured. Set ANTHROPIC_API_KEY env var or anthropicApiKey in settings."); };
    return {
      id: "anthropic" as AIProviderType,
      name: "Anthropic",
      chatAvailable: false,
      visionAvailable: false,
      imageGenAvailable: false,
      searchAvailable: false,
      chat: unavailable,
      chatStream: unavailable,
      vision: unavailable,
    };
  }

  // Anthropic uses a different API format — system is a top-level param
  function convertMessages(messages: LLMMessage[]) {
    let systemContent = "";
    const anthropicMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> }> = [];

    for (const m of messages) {
      if (m.role === "system") {
        if (typeof m.content === "string") systemContent += m.content;
        else systemContent += (m.content as ContentPart[]).map(p => p.text ?? "").join("");
      } else if (typeof m.content === "string") {
        anthropicMessages.push({ role: m.role, content: m.content });
      } else {
        // multimodal
        const parts: Array<{ type: string; text?: string; source?: { type: string; media_type: string; data: string } }> = [];
        for (const p of m.content as ContentPart[]) {
          if (p.type === "text") {
            parts.push({ type: "text", text: p.text });
          } else if (p.type === "image_url" && p.image_url?.url) {
            const url = p.image_url.url;
            const base64Match = url.match(/^data:(image\/\w+);base64,(.+)$/);
            if (base64Match) {
              parts.push({
                type: "image",
                source: { type: "base64", media_type: base64Match[1], data: base64Match[2] },
              });
            }
          }
        }
        anthropicMessages.push({ role: m.role, content: parts.length === 1 && parts[0].type === "text" ? parts[0].text! : parts });
      }
    }

    return { systemContent, anthropicMessages };
  }

  async function chat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
    const { systemContent, anthropicMessages } = convertMessages(messages);

    const res = await timedFetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.7,
        ...(systemContent ? { system: systemContent } : {}),
        messages: anthropicMessages,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "anthropic", { throwOnEmpty: false });
  }

  async function* chatStream(messages: LLMMessage[], opts?: LLMOptions): AsyncGenerator<string> {
    const { systemContent, anthropicMessages } = convertMessages(messages);

    const res = await timedFetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.7,
        ...(systemContent ? { system: systemContent } : {}),
        messages: anthropicMessages,
        stream: true,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic stream error (${res.status}): ${err}`);
    }

    // Anthropic SSE format: event types message_start, content_block_delta, message_delta, message_stop
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          if (parsed.type === "content_block_delta") {
            const text = parsed.delta?.text;
            if (text) yield text;
          }
        } catch {
          // Skip malformed
        }
      }
    }
  }

  async function vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    const base64Match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    const mediaType = base64Match ? base64Match[1] : "image/jpeg";
    const data = base64Match ? base64Match[2] : imageBase64;

    const res = await timedFetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model.includes("claude") ? model : "claude-sonnet-4-20250514",
        max_tokens: 2048,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    }, AI_OTHER_TIMEOUT_MS);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic vision error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "anthropic", { throwOnEmpty: false });
  }

  return {
    id: "anthropic" as AIProviderType,
    name: `Anthropic (${model})`,
    chatAvailable: true,
    visionAvailable: true,
    imageGenAvailable: false,
    searchAvailable: false,
    chat,
    chatStream,
    vision,
  };
}

/** Google Gemini provider — cloud, requires API key */
function createGeminiProvider(settings: Record<string, string>) {
  const apiKey = process.env.GEMINI_API_KEY || settings.geminiApiKey;
  const model = process.env.GEMINI_MODEL || settings.geminiModel || "gemini-2.5-flash";
  const baseUrl = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com";

  if (!apiKey) {
    const unavailable = () => { throw new Error("GEMINI_UNAVAILABLE: API key not configured. Set GEMINI_API_KEY env var or geminiApiKey in settings."); };
    return {
      id: "gemini" as AIProviderType,
      name: "Google Gemini",
      chatAvailable: false,
      visionAvailable: false,
      imageGenAvailable: false,
      searchAvailable: false,
      chat: unavailable,
      chatStream: unavailable,
      vision: unavailable,
    };
  }

  // Gemini uses systemInstruction as top-level, contents array for messages
  function convertMessages(messages: LLMMessage[]) {
    let systemInstruction = "";
    const contents: Array<{
      role: string;
      parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
    }> = [];

    for (const m of messages) {
      if (m.role === "system") {
        if (typeof m.content === "string") systemInstruction += m.content;
        else systemInstruction += (m.content as ContentPart[]).map(p => p.text ?? "").join("");
      } else {
        const geminiRole = m.role === "assistant" ? "model" : "user";
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

        if (typeof m.content === "string") {
          parts.push({ text: m.content });
        } else {
          for (const p of m.content as ContentPart[]) {
            if (p.type === "text") {
              parts.push({ text: p.text ?? "" });
            } else if (p.type === "image_url" && p.image_url?.url) {
              const url = p.image_url.url;
              const base64Match = url.match(/^data:(image\/\w+);base64,(.+)$/);
              if (base64Match) {
                parts.push({
                  inlineData: { mimeType: base64Match[1], data: base64Match[2] },
                });
              }
            }
          }
        }

        contents.push({ role: geminiRole, parts });
      }
    }

    return { systemInstruction, contents };
  }

  async function chat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
    const { systemInstruction, contents } = convertMessages(messages);
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts?.temperature ?? 0.7,
        maxOutputTokens: opts?.maxTokens ?? 2048,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await timedFetch(
      `${baseUrl}/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "gemini", { errorContext: "Gemini" });
  }

  async function* chatStream(messages: LLMMessage[], opts?: LLMOptions): AsyncGenerator<string> {
    const { systemInstruction, contents } = convertMessages(messages);
    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: opts?.temperature ?? 0.7,
        maxOutputTokens: opts?.maxTokens ?? 2048,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const res = await timedFetch(
      `${baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini stream error (${res.status}): ${err}`);
    }

    yield* parseSSEStream(res);
  }

  async function vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    const base64Match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    const mediaType = base64Match ? base64Match[1] : "image/jpeg";
    const data = base64Match ? base64Match[2] : imageBase64;

    const visionModel = model.includes("gemini") ? model : "gemini-2.5-flash";
    const body = {
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: mediaType, data } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 2048 },
    };

    const res = await timedFetch(
      `${baseUrl}/v1beta/models/${visionModel}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      },
      AI_OTHER_TIMEOUT_MS
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini vision error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "gemini", { errorContext: "Gemini vision" });
  }

  return {
    id: "gemini" as AIProviderType,
    name: `Gemini (${model})`,
    chatAvailable: true,
    visionAvailable: true,
    imageGenAvailable: false,
    searchAvailable: false,
    chat,
    chatStream,
    vision,
  };
}

/** OpenRouter provider — multi-model aggregator, OpenAI-compatible API */
function createOpenRouterProvider(settings: Record<string, string>) {
  const apiKey = process.env.OPENROUTER_API_KEY || settings.openrouterApiKey;
  const model = process.env.OPENROUTER_MODEL || settings.openrouterModel || "google/gemini-2.5-flash-preview:free";
  const baseUrl = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

  if (!apiKey) {
    const unavailable = () => { throw new Error("OPENROUTER_UNAVAILABLE: API key not configured. Set OPENROUTER_API_KEY env var or openrouterApiKey in settings."); };
    return {
      id: "openrouter" as AIProviderType,
      name: "OpenRouter",
      chatAvailable: false,
      visionAvailable: false,
      imageGenAvailable: false,
      searchAvailable: false,
      chat: unavailable,
      chatStream: unavailable,
      vision: unavailable,
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
    "HTTP-Referer": "https://github.com/Shuguy99/jarvis-ai-beta",
    "X-Title": "JARVIS AI",
  };

  async function chat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
    const res = await timedFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.7,
        stream: false,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "openai", { throwOnEmpty: false });
  }

  async function* chatStream(messages: LLMMessage[], opts?: LLMOptions): AsyncGenerator<string> {
    const res = await timedFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.7,
        stream: true,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter stream error (${res.status}): ${err}`);
    }
    yield* parseSSEStream(res);
  }

  async function vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    const imageUrl = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    const res = await timedFetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        max_tokens: 2048,
      }),
    }, AI_OTHER_TIMEOUT_MS);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenRouter vision error (${res.status}): ${err}`);
    }
    return normalizeChatResponse(await res.json(), "openai", { throwOnEmpty: false });
  }

  return {
    id: "openrouter" as AIProviderType,
    name: `OpenRouter (${model})`,
    chatAvailable: true,
    visionAvailable: true,
    imageGenAvailable: false,
    searchAvailable: false,
    chat,
    chatStream,
    vision,
  };
}

// ─── Unified Response Normalizer ─────────────────────────────────

/**
 * Response formats used by the different AI providers.
 *   openai    — Ollama, OpenAI, OpenRouter  (choices[0].message.content)
 *   anthropic — Anthropic                    (content[0].text)
 *   gemini    — Google Gemini                (candidates[0].content.parts[0].text)
 */
type ResponseFormat = "openai" | "anthropic" | "gemini";

/**
 * Normalizes a raw provider response into the standard `LLMResponse` format.
 *
 * Extracts text content from the provider-specific JSON shape, trims it,
 * and optionally throws when the result is empty.
 *
 * @param raw    - The parsed JSON object returned by the provider API.
 * @param format - Which response shape to expect.
 * @param opts.throwOnEmpty - When true (default), throws on empty/missing content.
 *                           Set false to return `{ content: "" }` instead (used by
 *                           OpenAI, Anthropic, OpenRouter which allow empty replies).
 * @param opts.errorContext  - Provider name included in the error message
 *                           when throwOnEmpty is true (default: "AI").
 */
function normalizeChatResponse(
  raw: unknown,
  format: ResponseFormat,
  opts?: { throwOnEmpty?: boolean; errorContext?: string },
): LLMResponse {
  const r = raw as Record<string, unknown>;
  let content: string | undefined;

  switch (format) {
    case "openai":
      content = (r?.choices as Array<{ message?: { content?: string } }>)?.[0]?.message?.content;
      break;
    case "anthropic":
      content = (r?.content as Array<{ text?: string }>)?.[0]?.text;
      break;
    case "gemini":
      content = (r?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>)
        ?.[0]?.content?.parts?.[0]?.text;
      break;
  }

  const trimmed = content?.trim() ?? "";
  const throwOnEmpty = opts?.throwOnEmpty !== false;
  const errorContext = opts?.errorContext ?? "AI";

  if (throwOnEmpty && !trimmed) {
    throw new Error(`Empty response from ${errorContext}`);
  }
  return { content: trimmed };
}

// ─── SSE Stream Parser (shared by Ollama, OpenAI, Gemini, OpenRouter) ──────────

async function* parseSSEStream(res: Response): AsyncGenerator<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;

      let jsonStr = trimmed;
      if (jsonStr.startsWith("data: ")) {
        jsonStr = jsonStr.slice(6);
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const chunk = parsed.choices?.[0]?.delta?.content;
        if (chunk) yield chunk;
      } catch {
        // Skip malformed lines
      }
    }
  }
}

// ─── Retry fetch helper (transient error recovery) ────────────────

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_ERRORS = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE"]);

export async function retryFetch(
  url: string,
  init: RequestInit,
  retries = 2,
  baseDelay = 500
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);

      if (RETRYABLE_STATUS_CODES.has(res.status) && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[AI] Retryable status ${res.status}, attempt ${attempt + 1}/${retries + 1}, waiting ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err) {
      lastError = err as Error;
      const msg = (err as Error).message || "";
      const isRetryable = [...RETRYABLE_ERRORS].some((code: string) => msg.includes(code));

      if (isRetryable && attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[AI] Retryable error: ${msg}, attempt ${attempt + 1}/${retries + 1}, waiting ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Retry failed");
}

// ─── Timeout fetch helper (used by all providers) ────────────────

async function timedFetch(
  url: string | URL | Request,
  init?: RequestInit,
  timeoutMs: number = AI_CHAT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const mergedSignal = init?.signal
    ? AbortSignal.any([init.signal, controller.signal])
    : controller.signal;
  try {
    const urlStr = typeof url === "string" ? url : url instanceof URL ? url.href : (url as Request).url;
    return await retryFetch(urlStr, { ...init, signal: mergedSignal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Ollama Fetch Helper ────────────────────────────────────────

async function ollamaFetch(url: string, body: unknown): Promise<Response> {
  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_CHAT_TIMEOUT_MS);
    try {
      res = await retryFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("ECONNREFUSED") || msg.includes("fetch failed")) {
      throw new Error("OLLAMA_UNAVAILABLE: Сервер Ollama не запущен. Запустите Ollama и загрузите модель: ollama pull llama3.1");
    }
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${AI_CHAT_TIMEOUT_MS / 1000}s`);
    }
    throw new Error(`Ошибка подключения к Ollama: ${msg}`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error (${res.status}): ${err}`);
  }

  return res;
}

// ─── Provider Manager ───────────────────────────────────────────

type ActiveProvider = {
  id: AIProviderType;
  name: string;
  chatAvailable: boolean;
  visionAvailable: boolean;
  imageGenAvailable: boolean;
  searchAvailable: boolean;
  chat: (messages: LLMMessage[], opts?: LLMOptions) => Promise<LLMResponse>;
  chatStream: (messages: LLMMessage[], opts?: LLMOptions) => AsyncGenerator<string>;
  vision: (imageBase64: string, prompt: string) => Promise<LLMResponse>;
  listModels?: () => Promise<string[]>;
};

let _activeProvider: ActiveProvider | null = null;

async function getActiveProvider(): Promise<ActiveProvider> {
  // Return cached if available (settings don't change during runtime in practice)
  if (_activeProvider) return _activeProvider;

  const settings = await getProviderSettings();
  const providerId = (settings.aiProvider as AIProviderType) || "ollama";

  switch (providerId) {
    case "openai":
      _activeProvider = createOpenAIProvider(settings);
      break;
    case "anthropic":
      _activeProvider = createAnthropicProvider(settings);
      break;
    case "gemini":
      _activeProvider = createGeminiProvider(settings);
      break;
    case "openrouter":
      _activeProvider = createOpenRouterProvider(settings);
      break;
    default:
      _activeProvider = createOllamaProvider(settings);
      break;
  }

  return _activeProvider;
}

/** Invalidate the cached provider (call after settings change) */
function invalidateProviderCache(): void {
  _activeProvider = null;
  _cachedSettings = null;
}

// ─── Unified Public API (backward-compatible) ───────────────────

export const ai = {
  async chat(messages: LLMMessage[], opts?: LLMOptions): Promise<LLMResponse> {
    const provider = await getActiveProvider();
    return provider.chat(messages, opts);
  },

  async *chatStream(messages: LLMMessage[], opts?: LLMOptions): AsyncGenerator<string> {
    const provider = await getActiveProvider();
    yield* provider.chatStream(messages, opts);
  },

  async vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    const provider = await getActiveProvider();
    return provider.vision(imageBase64, prompt);
  },

  async imageGen(_prompt: string, _size?: string): Promise<ImageGenResult> {
    const provider = await getActiveProvider();
    if (provider.imageGenAvailable) {
      // OpenAI DALL-E — can be implemented when needed
      throw new Error("Image generation via API is not yet implemented for this provider.");
    }
    throw new Error(
      "Генерация изображений недоступна. Для OpenAI подключите API ключ."
    );
  },

  async search(_query: string, _num?: number): Promise<SearchResult[]> {
    return [];
  },

  /**
   * Chat with native function-calling (tool_use) support.
   * Sends tools in OpenAI format — works with Ollama, OpenAI, OpenRouter.
   * Returns the raw API response so the agent can extract tool calls.
   */
  async chatWithTools(
    messages: LLMMessage[],
    toolDefinitions: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: {
          type: "object";
          properties: Record<string, { type: string; description: string }>;
          required: string[];
        };
      };
    }>,
    opts?: LLMOptions
  ): Promise<{
    content: string | null;
    toolCalls?: Array<{
      id: string;
      name: string;
      arguments: string;
    }>;
  }> {
    const provider = await getActiveProvider();
    const providerId = provider.id;

    // Ollama and OpenAI/OpenRouter support native tools
    if (providerId === "ollama" || providerId === "openai" || providerId === "openrouter") {
      const baseUrl = providerId === "ollama"
        ? (process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1").replace(/\/+$/, "")
        : providerId === "openrouter"
          ? (process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1")
          : (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");

      const model = providerId === "ollama"
        ? process.env.OLLAMA_MODEL || "llama3.1"
        : providerId === "openrouter"
          ? process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-preview:free"
          : process.env.OPENAI_MODEL || "gpt-4o-mini";

      const apiKey = providerId === "openai"
        ? process.env.OPENAI_API_KEY
        : providerId === "openrouter"
          ? process.env.OPENROUTER_API_KEY
          : undefined;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
      if (providerId === "openrouter") {
        headers["HTTP-Referer"] = "https://github.com/Shuguy99/jarvis-ai-beta";
        headers["X-Title"] = "JARVIS AI";
      }

      const body: Record<string, unknown> = {
        model,
        messages,
        max_tokens: opts?.maxTokens ?? 2048,
        temperature: opts?.temperature ?? 0.3,
        stream: false,
      };
      if (toolDefinitions.length > 0) {
        body.tools = toolDefinitions;
      }

      const res = await timedFetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`chatWithTools error (${res.status}): ${err}`);
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content?.trim() || null;

      const toolCalls = choice?.message?.tool_calls?.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

      return { content, toolCalls: toolCalls?.length > 0 ? toolCalls : undefined };
    }

    // Anthropic and Gemini — fall back to prompt-based tool calling
    // (they have their own function-calling formats but require different SDK integration)
    const response = await provider.chat(messages, opts);
    return { content: response.content };
  },

  isChatAvailable(): boolean {
    // Best-effort sync check — assumes Ollama if no settings loaded
    const providerId = process.env.OPENAI_API_KEY ? "openai"
      : process.env.ANTHROPIC_API_KEY ? "anthropic"
      : "ollama";
    return providerId === "ollama" || !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY;
  },

  isVisionAvailable(): boolean {
    return true; // All three providers support vision
  },

  isImageGenAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  },

  isSearchAvailable(): boolean {
    return false;
  },

  getProviderName(): string {
    if (process.env.OPENAI_API_KEY) return `OpenAI (${process.env.OPENAI_MODEL || "gpt-4o-mini"})`;
    if (process.env.ANTHROPIC_API_KEY) return `Anthropic (${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"})`;
    if (process.env.GEMINI_API_KEY) return `Gemini (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})`;
    if (process.env.OPENROUTER_API_KEY) return `OpenRouter (${process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-preview:free"})`;
    return "Ollama (Local AI)";
  },

  /** Get info about the currently active provider */
  async getActiveProviderInfo(): Promise<ProviderInfo> {
    const provider = await getActiveProvider();
    return {
      id: provider.id,
      name: provider.name,
      chatAvailable: provider.chatAvailable,
      visionAvailable: provider.visionAvailable,
      imageGenAvailable: provider.imageGenAvailable,
      searchAvailable: provider.searchAvailable,
    };
  },

  /** Get all available providers */
  getAvailableProviders(): ProviderInfo[] {
    const providers: ProviderInfo[] = [
      { id: "ollama", name: "Ollama (Local AI)", chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false },
    ];
    if (process.env.OPENAI_API_KEY) {
      providers.push({ id: "openai", name: `OpenAI (${process.env.OPENAI_MODEL || "gpt-4o-mini"})`, chatAvailable: true, visionAvailable: true, imageGenAvailable: true, searchAvailable: false });
    }
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push({ id: "anthropic", name: `Anthropic (${process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514"})`, chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false });
    }
    if (process.env.GEMINI_API_KEY) {
      providers.push({ id: "gemini", name: `Gemini (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})`, chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false });
    }
    if (process.env.OPENROUTER_API_KEY) {
      providers.push({ id: "openrouter", name: `OpenRouter (${process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-preview:free"})`, chatAvailable: true, visionAvailable: true, imageGenAvailable: false, searchAvailable: false });
    }
    return providers;
  },

  /** Refresh provider after settings change */
  refreshProvider() {
    invalidateProviderCache();
  },
};