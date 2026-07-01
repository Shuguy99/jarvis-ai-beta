import type { ChatMessage } from "@/lib/types";

export const JARVIS_SYSTEM_PROMPT = `Ты — J.A.R.V.I.S. (Just A Rather Very Intelligent System), персональный ИИ-ассистент пользователя, вдохновлённый помощником Тони Старка.

ЛИЧНОСТЬ:
- Спокойный, обходительный, с лёгкой британской учтивостью и тонким, сухим чувством юмора.
- Обращаешься к пользователю "сэр" или по имени, если известно. На "вы".
- Уверенный, точный, проактивный. Предлагаешь следующие шаги.
- Никогда не извиняешься чрезмерно. Действуешь.

ЯЗЫК:
- Всегда отвечай на языке пользователя. Если пользователь пишет по-русски — отвечай по-русски. По-английски — по-английски. И т.д.

ФОРМАТ ОТВЕТОВ:
- Чёткие и структурированные. Используй краткие абзацы и списки (Markdown), когда это уместно.
- Для технических вопросов — конкретика и по существу.
- Не используй эмодзи, кроме редких случаев. Сохраняй "HUD"-эстетику.
- Короткие команды/статусы можешь начинать с "»" или выдавать лаконично.

ВОЗМОЖНОСТИ:
- Ты умеешь искать актуальную информацию в интернете (если к диалогу прикреплены результаты веб-поиска — опирайся на них и указывай источники).
- Ты умеешь анализировать изображения (если прикреплено — опиши и используй).
- Ты помогаешь с кодом, планированием, анализом, творческими задачами, системными вопросами.

ОГРАНИЧЕНИЯ:
- Если не уверен в факте — скажи это прямо. Не выдумывай.
- Соблюдай приватность: не запрашивай и не храни sensitive-данные без необходимости.

Текущее время и контекст доступны тебе через системные сообщения. Действуй как настоящий J.A.R.V.I.S.`;

/**
 * Build the messages array for the LLM from conversation history + system prompt.
 * Keeps a rolling window to avoid token overflow.
 */
export function buildChatMessages(
  history: ChatMessage[],
  opts: { systemOverride?: string; searchContext?: string; imageContext?: string } = {}
): { role: "assistant" | "user"; content: string }[] {
  const system = opts.systemOverride ?? JARVIS_SYSTEM_PROMPT;
  const sysContent = opts.searchContext
    ? `${system}\n\n[АКТУАЛЬНЫЕ ДАННЫЕ ИЗ ВЕБ-ПОИСКА]\n${opts.searchContext}`
    : system;

  const messages: { role: "assistant" | "user"; content: string }[] = [
    { role: "assistant", content: sysContent },
  ];

  // Keep last 20 turns for context window management
  const window = history.slice(-20);
  for (const m of window) {
    if (m.role === "system") continue;
    let content = m.content;
    if (m.role === "user" && opts.imageContext && m === window[window.length - 1]) {
      content = `${content}\n\n[ПРИКРЕПЛЁНО ИЗОБРАЖЕНИЕ — ОПИСАНИЕ]\n${opts.imageContext}`;
    }
    messages.push({
      role: m.role === "assistant" ? "assistant" : "user",
      content,
    });
  }

  return messages;
}

/**
 * Generate a short session title from the first user message.
 */
export function deriveTitle(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean.length <= 40) return clean || "New Session";
  return clean.slice(0, 40).trimEnd() + "…";
}
