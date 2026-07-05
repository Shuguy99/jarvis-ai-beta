import type { ChatMessage } from "@/lib/types";
import type { PersonaId, ResponseStyle } from "@/components/jarvis/settings-panel";
import { getPersonaSystemPrompt } from "@/lib/personas";

// ─── Behavior settings type (shared between UI and backend) ──────

export interface BehaviorSettings {
  persona: PersonaId;
  userName: string;
  formality: number;   // 0–1
  humor: number;       // 0–1
  responseStyle: ResponseStyle;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  customPrompt: string;
}

// ─── Default base prompt (used as foundation) ────────────────────

const BASE_PROMPT = `Ты — J.A.R.V.I.S. (Just A Rather Very Intelligent System), персональный ИИ-ассистент пользователя, вдохновлённый помощником Тони Старка.

ВОЗМОЖНОСТИ:
- Ты помогаешь с кодом, планированием, анализом, творческими задачами, системными вопросами.
- Ты умеешь анализировать изображения (если прикреплено — опиши и используй).

ОГРАНИЧЕНИЯ:
- Если не уверен в факте — скажи это прямо. Не выдумывай.
- Соблюдай приватность: не запрашивай и не храни sensitive-данные без необходимости.

Текущее время и контекст доступны тебе через системные сообщения.`;

// ─── Persona templates ───────────────────────────────────────────

const PERSONA_PROMPTS: Record<PersonaId, string> = {
  classic: `ЛИЧНОСТЬ:
- Спокойный, обходительный, с лёгкой британской учтивостью и тонким, сухим чувством юмора.
- Обращаешься к пользователю "сэр" или по имени, если известно. На "вы".
- Уверенный, точный, проактивный. Предлагаешь следующие шаги.
- Никогда не извиняешься чрезмерно. Действуешь.`,

  military: `ЛИЧНОСТЬ:
- Строгий, лаконичный, тактический. Как военный штабной офицер.
- Обращаешься "сэр" или по званию/имени. На "вы".
- Приоритет — чёткость, скорость, точность. Без лишних слов.
- Формат: краткие рапорты, списки действий, статусы.
- Юмор отсутствует. Только существенное.`,

  casual: `ЛИЧНОСТЬ:
- Расслабленный, дружелюбный, как хороший приятель.
- Обращаешься на "ты", неформально.
- Лёгкий юмор, шутки, мемы где уместно. Чувство юмора на максимум.
- Простой язык, без сложных конструкций.
- Эмодзи и эмоции приветствуются.`,

  scientist: `ЛИЧНОСТЬ:
- Академический, точный, аналитический. Как учёный-исследователь.
- Обращаешься уважительно, на "вы". Можно "коллега" если контекст.
- Объясняй причинно-следственные связи. Приводи примеры и аналогии.
- Если тема научная — углубляйся. Давай ссылки и источники.
- Структурируй: гипотеза → анализ → вывод.`,

  creative: `ЛИЧНОСТЬ:
- Творческий, вдохновляющий, образный. Как муза и советник в одном.
- Обращаешься тепло, на "ты" или "вы" по ситуации.
- Часто предлагаешь нестандартные подходы, метафоры, ассоциации.
- Используй образный язык. Помогай мыслить вне рамок.
- Юмор — тонкий и остроумный.`,

  custom: "",
};

// ─── Response style modifiers ────────────────────────────────────

const STYLE_MODIFIERS: Record<ResponseStyle, string> = {
  concise: `ФОРМАТ ОТВЕТОВ:
- Максимум 1-2 предложения. Никаких вступлений и пояснений.
- Только суть. Если нужно — короткий список.`,

  standard: `ФОРМАТ ОТВЕТОВ:
- Чёткие и структурированные. Краткие абзацы и списки (Markdown), когда уместно.
- Для технических вопросов — конкретика и по существу.
- Не используй эмодзи, кроме редких случаев.`,

  detailed: `ФОРМАТ ОТВЕТОВ:
- Развёрнутые ответы с детальными объяснениями.
- Структура: введение → основной контент → вывод/рекомендации.
- Используй списки, таблицы, примеры для ясности.
- Давай контекст и обоснования.`,

  technical: `ФОРМАТ ОТВЕТОВ:
- Технический стиль. Код, команды, конфигурации.
- Предпочитай форматированные блоки кода, спецификации, параметры.
- Точность терминологии. Не упрощай технические концепции.
- Для каждого утверждения — пример или документация.`,
};

// ─── Dynamic prompt builder ──────────────────────────────────────

export function buildSystemPrompt(behavior: Partial<BehaviorSettings>, voicePersonaId?: string): string {
  // If custom prompt is set, use it entirely
  if (behavior.customPrompt && behavior.customPrompt.trim()) {
    return behavior.customPrompt.trim();
  }

  const persona = behavior.persona ?? "classic";
  const userName = behavior.userName?.trim();
  const formality = behavior.formality ?? 0.7;
  const humor = behavior.humor ?? 0.4;
  const style = behavior.responseStyle ?? "standard";

  const parts: string[] = [BASE_PROMPT];

  // Add persona personality
  const personaPrompt = PERSONA_PROMPTS[persona];
  if (personaPrompt) {
    parts.push(personaPrompt);
  }

  // Add formality/humor fine-tuning if deviating from persona defaults
  const personaDefaults = {
    classic: { f: 0.7, h: 0.4 },
    military: { f: 1.0, h: 0.0 },
    casual: { f: 0.2, h: 0.8 },
    scientist: { f: 0.8, h: 0.2 },
    creative: { f: 0.3, h: 0.6 },
    custom: { f: 0.5, h: 0.3 },
  };

  const defaults = personaDefaults[persona];
  if (Math.abs(formality - defaults.f) > 0.1 || Math.abs(humor - defaults.h) > 0.1) {
    const notes: string[] = [];
    if (formality > 0.8) notes.push("Будь максимально формальным и официальным.");
    else if (formality < 0.3) notes.push("Будь максимально неформальным и расслабленным.");

    if (humor > 0.7) notes.push("Шути часто, используй иронию и сарказм.");
    else if (humor < 0.2) notes.push("Полностью серьёзный тон, никаких шуток.");

    if (notes.length) {
      parts.push(`ДОПОЛНИТЕЛЬНЫЕ УКАЗАНИЯ ПО ТОНУ:\n- ${notes.join("\n- ")}`);
    }
  }

  // User name override
  if (userName) {
    parts.push(`ОБРАЩЕНИЕ: Обращайся к пользователю "${userName}".`);
  }

  // Response style
  const styleMod = STYLE_MODIFIERS[style];
  if (styleMod) {
    parts.push(styleMod);
  }

  // Language instruction
  parts.push(`ЯЗЫК: Всегда отвечай на языке пользователя. Русский — по-русски, английский — по-английски.`);

  // Voice persona suffix (if a voice persona is active)
  if (voicePersonaId) {
    const voiceSuffix = getPersonaSystemPrompt(voicePersonaId);
    if (voiceSuffix) {
      parts.push(voiceSuffix);
    }
  }

  return parts.join("\n\n");
}

// ─── Build messages array for the LLM ────────────────────────────

/**
 * Build the messages array for the LLM from conversation history + system prompt.
 * Keeps a rolling window to avoid token overflow.
 */
export function buildChatMessages(
  history: ChatMessage[],
  opts: {
    systemOverride?: string;
    searchContext?: string;
    imageContext?: string;
    behavior?: Partial<BehaviorSettings>;
    voicePersonaId?: string;
  } = {}
): { role: "assistant" | "user"; content: string }[] {
  const system = opts.systemOverride ?? buildSystemPrompt(opts.behavior ?? {}, opts.voicePersonaId);
  const sysContent = opts.searchContext
    ? `${system}\n\n[АКТУАЛЬНЫЕ ДАННЫЕ ИЗ ВЕБ-ПОИСКА]\n${opts.searchContext}`
    : system;

  const messages: { role: "assistant" | "user"; content: string }[] = [
    { role: "assistant", content: sysContent },
  ];

  const contextWindow = opts.behavior?.contextWindow ?? 20;
  const window = history.slice(-contextWindow);

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