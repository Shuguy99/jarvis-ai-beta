/**
 * AI Provider — ZAI SDK (z-ai-web-dev-sdk)
 *
 * No API keys needed. Everything works out of the box.
 * Uses the built-in z-ai-web-dev-sdk for chat, vision, image generation,
 * web search, TTS, and ASR.
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

// ─── Singleton ZAI instance ─────────────────────────────────────

let zaiInstance: Awaited<ReturnType<typeof import("z-ai-web-dev-sdk").default.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Chat (LLM) ──────────────────────────────────────────────────

async function zaiChat(messages: LLMMessage[]): Promise<LLMResponse> {
  const zai = await getZAI();

  const completion = await zai.chat.completions.create({
    messages: messages.map((m) => ({
      // ZAI SDK uses "assistant" role for system prompts
      role: m.role === "system" ? "assistant" : (m.role as "user" | "assistant"),
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    thinking: { type: "disabled" },
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from AI");
  return { content };
}

// ─── Vision (VLM) ────────────────────────────────────────────────

async function zaiVision(imageBase64: string, prompt: string): Promise<LLMResponse> {
  const zai = await getZAI();

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
  if (!content) throw new Error("Empty response from vision model");
  return { content };
}

// ─── Image Generation ────────────────────────────────────────────

async function zaiImageGen(prompt: string, size: string): Promise<ImageGenResult> {
  const zai = await getZAI();

  const response = await zai.images.generations.create({
    prompt: prompt.trim(),
    size: size || "1024x1024",
  });

  const base64 = response.data?.[0]?.base64;
  if (!base64) throw new Error("Image generation returned no data");
  return { base64 };
}

// ─── Web Search ──────────────────────────────────────────────────

async function zaiSearch(query: string, num: number): Promise<SearchResult[]> {
  const zai = await getZAI();

  const results = (await zai.functions.invoke("web_search", { query, num })) as SearchResult[];
  return Array.isArray(results) ? results.slice(0, num) : [];
}

// ─── Unified API ─────────────────────────────────────────────────

export const ai = {
  /** Send messages to the LLM and get a response */
  async chat(messages: LLMMessage[]): Promise<LLMResponse> {
    return zaiChat(messages);
  },

  /** Analyze an image with a vision model */
  async vision(imageBase64: string, prompt: string): Promise<LLMResponse> {
    return zaiVision(imageBase64, prompt);
  },

  /** Generate an image from a text prompt */
  async imageGen(prompt: string, size: string = "1024x1024"): Promise<ImageGenResult> {
    return zaiImageGen(prompt, size);
  },

  /** Perform a web search */
  async search(query: string, num: number = 6): Promise<SearchResult[]> {
    return zaiSearch(query, num);
  },

  /** Check if a specific feature is available (always true with ZAI) */
  isChatAvailable(): boolean {
    return true;
  },

  isVisionAvailable(): boolean {
    return true;
  },

  isImageGenAvailable(): boolean {
    return true;
  },

  isSearchAvailable(): boolean {
    return true;
  },

  getProviderName(): string {
    return "J.A.R.V.I.S. AI";
  },
};