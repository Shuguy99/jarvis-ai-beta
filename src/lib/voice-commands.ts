/**
 * JARVIS Voice Command NLP Parser
 *
 * Keyword-based intent recognition for Russian + English natural language.
 * Uses regex + keyword sets (NOT LLM) for speed.
 *
 * Returns a structured ParsedCommand or null if no intent matches.
 */

// ── Types ─────────────────────────────────────────────────────

export interface ParsedCommand {
  intent: string;
  params: Record<string, string>;
  confidence: number;
  display: string;
}

// ── All supported intents ─────────────────────────────────────

export const INTENT_LIST = [
  "open_widget",
  "set_timer",
  "toggle_theme",
  "toggle_fullscreen",
  "new_chat",
  "capture_screen",
  "toggle_notes",
  "toggle_voice",
  "search_web",
  "get_weather",
  "get_time",
  "system_status",
  "analyze_image",
  "generate_image",
  "start_pomodoro",
  "calculator",
] as const;

export type Intent = (typeof INTENT_LIST)[number];

// ── Intent definitions ────────────────────────────────────────

interface IntentRule {
  intent: Intent;
  /** Ordered keyword groups — first match wins, longer groups score higher */
  keywords: string[][];
  /** Regex for param extraction (e.g. timer duration) */
  paramRegex?: RegExp[];
  /** Russian display text */
  display: string;
  /** Base confidence when matched (0–1) */
  baseConfidence: number;
}

const RULES: IntentRule[] = [
  // ─── open_widget ───────────────────────────────────────────
  {
    intent: "open_widget",
    keywords: [
      // Russian
      ["открой", "заметки"],
      ["покажи", "заметки"],
      ["открой", "процессы"],
      ["покажи", "процессы"],
      ["покажи", "процессы"],
      ["покажи", "календарь"],
      ["открой", "календарь"],
      ["покажи", "настройки"],
      ["открой", "настройки"],
      ["покажи", "файлы"],
      ["открой", "файлы"],
      ["покажи", "погоду"],
      ["открой", "погоду"],
      ["покажи", "музыку"],
      ["открой", "музыку"],
      ["покажи", "монитор"],
      ["открой", "монитор"],
      ["покажи", "калькулятор"],
      ["открой", "калькулятор"],
      ["покажи", "помодоро"],
      ["открой", "помодоро"],
      // English
      ["open", "notes"],
      ["show", "notes"],
      ["open", "processes"],
      ["show", "processes"],
      ["show", "calendar"],
      ["open", "calendar"],
      ["open", "settings"],
      ["show", "settings"],
      ["show", "files"],
      ["open", "files"],
      ["show", "weather"],
      ["open", "weather"],
      ["show", "music"],
      ["open", "music"],
      ["show", "monitor"],
      ["open", "monitor"],
      ["show", "calculator"],
      ["open", "calculator"],
      ["show", "pomodoro"],
      ["open", "pomodoro"],
    ],
    display: "Открытие виджета",
    baseConfidence: 0.85,
  },

  // ─── set_timer ─────────────────────────────────────────────
  {
    intent: "set_timer",
    keywords: [
      ["таймер", "минут"],
      ["таймер", "секунд"],
      ["таймер", "на"],
      ["установи", "таймер"],
      ["поставь", "таймер"],
      ["запусти", "таймер"],
      ["set", "timer"],
      ["start", "timer"],
    ],
    paramRegex: [
      /(\d+)\s*(?:минут(?:ы|у|)?|min(?:ute)?s?)/i,
      /(\d+)\s*(?:секунд(?:ы|у|)?|sec(?:ond)?s?)/i,
    ],
    display: "Таймер установлен",
    baseConfidence: 0.9,
  },

  // ─── toggle_theme ──────────────────────────────────────────
  {
    intent: "toggle_theme",
    keywords: [
      ["тема"],
      ["сменить", "тему"],
      ["смени", "тему"],
      ["смени", "костюм"],
      ["сменить", "костюм"],
      ["смени", "тему"],
      ["switch", "theme"],
      ["change", "theme"],
      ["change", "costume"],
      ["новая", "тема"],
      ["другая", "тема"],
    ],
    display: "Смена темы",
    baseConfidence: 0.8,
  },

  // ─── toggle_fullscreen ─────────────────────────────────────
  {
    intent: "toggle_fullscreen",
    keywords: [
      ["на", "весь", "экран"],
      ["полный", "экран"],
      ["во", "весь", "экран"],
      ["выйти", "полного", "экрана"],
      ["fullscreen"],
      ["full", "screen"],
      ["toggle", "fullscreen"],
    ],
    display: "Полный экран",
    baseConfidence: 0.9,
  },

  // ─── new_chat ──────────────────────────────────────────────
  {
    intent: "new_chat",
    keywords: [
      ["новый", "чат"],
      ["новый", "диалог"],
      ["новая", "беседа"],
      ["начать", "заново"],
      ["очистить", "чат"],
      ["new", "chat"],
      ["new", "conversation"],
      ["clear", "chat"],
      ["new", "dialog"],
    ],
    display: "Новый диалог",
    baseConfidence: 0.85,
  },

  // ─── capture_screen ────────────────────────────────────────
  {
    intent: "capture_screen",
    keywords: [
      ["захват", "экрана"],
      ["сделай", "скриншот"],
      ["сделать", "скриншот"],
      ["скриншот"],
      ["скрин"],
      ["capture", "screen"],
      ["screenshot"],
      ["take", "screenshot"],
    ],
    display: "Захват экрана",
    baseConfidence: 0.9,
  },

  // ─── toggle_notes ──────────────────────────────────────────
  {
    intent: "toggle_notes",
    keywords: [
      ["заметки"],
      ["открыть", "заметки"],
      ["закрыть", "заметки"],
      ["покажи", "заметки"],
      ["скрыть", "заметки"],
      ["notes"],
      ["open", "notes"],
      ["close", "notes"],
    ],
    display: "Заметки",
    baseConfidence: 0.85,
  },

  // ─── toggle_voice ──────────────────────────────────────────
  {
    intent: "toggle_voice",
    keywords: [
      ["выключи", "звук"],
      ["включи", "звук"],
      ["выключить", "звук"],
      ["включить", "звук"],
      ["без", "звука"],
      ["включи", "озвучку"],
      ["выключи", "озвучку"],
      ["звук", "выкл"],
      ["звук", "вкл"],
      ["mute"],
      ["unmute"],
      ["sound", "off"],
      ["sound", "on"],
      ["turn", "off", "sound"],
      ["turn", "on", "sound"],
    ],
    display: "Управление звуком",
    baseConfidence: 0.85,
  },

  // ─── search_web ────────────────────────────────────────────
  {
    intent: "search_web",
    keywords: [
      ["найди"],
      ["поиск"],
      ["найти"],
      ["поищи"],
      ["ищи"],
      ["загугли"],
      ["гугл"],
      ["search"],
      ["search", "for"],
      ["google"],
      ["look", "up"],
    ],
    display: "Веб-поиск",
    baseConfidence: 0.75,
  },

  // ─── get_weather ───────────────────────────────────────────
  {
    intent: "get_weather",
    keywords: [
      ["погода"],
      ["какая", "погода"],
      ["какой", "погода"],
      ["прогноз", "погоды"],
      ["погода", "сейчас"],
      ["weather"],
      ["what", "weather"],
      ["weather", "forecast"],
      ["weather", "today"],
    ],
    display: "Прогноз погоды",
    baseConfidence: 0.9,
  },

  // ─── get_time ──────────────────────────────────────────────
  {
    intent: "get_time",
    keywords: [
      ["который", "час"],
      ["сколько", "времени"],
      ["время"],
      ["какое", "время"],
      ["какая", "дата"],
      ["какой", "день"],
      ["what", "time"],
      ["what", "date"],
      ["current", "time"],
      ["tell", "time"],
    ],
    display: "Определение времени",
    baseConfidence: 0.9,
  },

  // ─── system_status ─────────────────────────────────────────
  {
    intent: "system_status",
    keywords: [
      ["статус", "системы"],
      ["система", "статус"],
      ["как", "дела"],
      ["как", "система"],
      ["состояние", "системы"],
      ["диагностика"],
      ["report", "status"],
      ["system", "status"],
      ["how", "are", "you"],
      ["system", "report"],
      ["diagnostics"],
    ],
    display: "Статус системы",
    baseConfidence: 0.85,
  },

  // ─── analyze_image ─────────────────────────────────────────
  {
    intent: "analyze_image",
    keywords: [
      ["проанализируй", "изображение"],
      ["проанализируй", "картинку"],
      ["анализ", "изображения"],
      ["опиши", "изображение"],
      ["опиши", "картинку"],
      ["что", "изображено"],
      ["analyze", "image"],
      ["analyze", "picture"],
      ["describe", "image"],
      ["describe", "picture"],
      ["what", "in", "image"],
    ],
    display: "Анализ изображения",
    baseConfidence: 0.85,
  },

  // ─── generate_image ────────────────────────────────────────
  {
    intent: "generate_image",
    keywords: [
      ["создай", "картинку"],
      ["создай", "изображение"],
      ["нарисуй"],
      ["сгенерируй", "картинку"],
      ["сгенерируй", "изображение"],
      ["сделай", "картинку"],
      ["сделай", "изображение"],
      ["generate", "image"],
      ["generate", "picture"],
      ["create", "image"],
      ["draw"],
      ["make", "image"],
      ["make", "picture"],
    ],
    display: "Генерация изображения",
    baseConfidence: 0.85,
  },

  // ─── start_pomodoro ────────────────────────────────────────
  {
    intent: "start_pomodoro",
    keywords: [
      ["помодоро"],
      ["помодор"],
      ["фокус", "режим"],
      ["режим", "фокус"],
      ["фокус", "сессия"],
      ["pomodoro"],
      ["focus", "mode"],
      ["start", "pomodoro"],
      ["focus", "session"],
    ],
    display: "Режим Помодоро",
    baseConfidence: 0.9,
  },

  // ─── calculator ────────────────────────────────────────────
  {
    intent: "calculator",
    keywords: [
      ["калькулятор"],
      ["посчитай"],
      ["посчитать"],
      ["вычисли"],
      ["вычислить"],
      ["calculator"],
      ["calculate"],
      ["compute"],
    ],
    display: "Калькулятор",
    baseConfidence: 0.85,
  },
];

// ── Helpers ───────────────────────────────────────────────────

/** Lowercase + trim for matching */
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\sа-яё]/gi, " ").replace(/\s+/g, " ");
}

/** Check if all keywords in a group appear in the normalized text */
function groupMatches(text: string, group: string[]): boolean {
  return group.every((kw) => text.includes(kw.toLowerCase()));
}

/** Extract widget name from text for open_widget intent */
function extractWidgetName(text: string): string {
  const widgetMap: Record<string, string[]> = {
    notes: ["заметки", "notes"],
    processes: ["процессы", "processes", "процесс"],
    calendar: ["календарь", "calendar"],
    settings: ["настройки", "settings"],
    files: ["файлы", "files"],
    weather: ["погоду", "погод", "weather"],
    music: ["музыку", "музык", "music"],
    monitor: ["монитор", "monitor", "системный", "system"],
    calculator: ["калькулятор", "calculator"],
    pomodoro: ["помодоро", "pomodoro"],
  };

  for (const [name, keywords] of Object.entries(widgetMap)) {
    if (keywords.some((kw) => text.includes(kw))) return name;
  }
  return "";
}

/** Extract timer value + unit */
function extractTimerParams(text: string): Record<string, string> {
  const params: Record<string, string> = {};

  const minMatch = text.match(/(\d+)\s*(?:минут(?:ы|у|)?|min(?:ute)?s?)/i);
  const secMatch = text.match(/(\d+)\s*(?:секунд(?:ы|у|)?|sec(?:ond)?s?)/i);

  if (minMatch) params.minutes = minMatch[1];
  if (secMatch) params.seconds = secMatch[1];

  // Bare number without unit — assume minutes
  if (!minMatch && !secMatch) {
    const bareMatch = text.match(/(\d+)/);
    if (bareMatch) params.minutes = bareMatch[1];
  }

  return params;
}

/** Extract search query (everything after the trigger keyword) */
function extractSearchQuery(text: string): string {
  const triggers = ["найди", "поиск", "найти", "поищи", "ищи", "search for", "google", "search"];
  const lower = text.toLowerCase();

  for (const trigger of triggers) {
    const idx = lower.indexOf(trigger);
    if (idx !== -1) {
      return text.slice(idx + trigger.length).trim();
    }
  }
  return text;
}

/** Detect toggle_voice direction (on/off/mute/unmute) */
function extractVoiceDirection(text: string): string {
  const lower = text.toLowerCase();
  const offWords = ["выключ", "mute", "off", "без"];
  const onWords = ["включ", "unmute", "on"];

  for (const w of offWords) {
    if (lower.includes(w)) return "off";
  }
  for (const w of onWords) {
    if (lower.includes(w)) return "on";
  }
  return "toggle";
}

// ── Main parser ───────────────────────────────────────────────

export function parseCommand(text: string): ParsedCommand | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  let bestMatch: {
    rule: IntentRule;
    confidence: number;
    matchedGroupLen: number;
  } | null = null;

  for (const rule of RULES) {
    for (const group of rule.keywords) {
      if (groupMatches(normalized, group)) {
        // Longer keyword groups = more specific = higher confidence
        const specificityBonus = Math.min(group.length * 0.03, 0.15);
        const confidence = Math.min(rule.baseConfidence + specificityBonus, 1.0);

        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { rule, confidence, matchedGroupLen: group.length };
        }
      }
    }
  }

  if (!bestMatch) return null;

  const { rule, confidence } = bestMatch;

  // Extract params based on intent
  let params: Record<string, string> = {};

  switch (rule.intent) {
    case "open_widget":
      params = { widget: extractWidgetName(normalized) };
      break;
    case "set_timer":
      params = extractTimerParams(normalized);
      break;
    case "search_web":
      params = { query: extractSearchQuery(text) };
      break;
    case "toggle_voice":
      params = { direction: extractVoiceDirection(normalized) };
      break;
    case "toggle_theme": {
      // Try to extract theme name (e.g. "mark 42", "тёмная", "светлая")
      const themeMatch = normalized.match(/(?:тема|theme|костюм)\s+(.+)/);
      if (themeMatch) params = { theme: themeMatch[1].trim() };
      break;
    }
    default:
      break;
  }

  // Build display text with param details
  let display = rule.display;
  if (rule.intent === "set_timer") {
    const mins = params.minutes ? `${params.minutes} мин` : "";
    const secs = params.seconds ? `${params.seconds} сек` : "";
    const detail = [mins, secs].filter(Boolean).join(" ");
    if (detail) display = `Таймер: ${detail}`;
  } else if (rule.intent === "search_web" && params.query) {
    display = `Поиск: ${params.query}`;
  } else if (rule.intent === "open_widget" && params.widget) {
    const widgetNames: Record<string, string> = {
      notes: "Заметки",
      processes: "Процессы",
      calendar: "Календарь",
      settings: "Настройки",
      files: "Файлы",
      weather: "Погода",
      music: "Музыка",
      monitor: "Монитор",
      calculator: "Калькулятор",
      pomodoro: "Помодоро",
    };
    display = `Виджет: ${widgetNames[params.widget] ?? params.widget}`;
  } else if (rule.intent === "toggle_voice") {
    const dirLabels: Record<string, string> = { on: "Вкл.", off: "Выкл.", toggle: "Переключить" };
    display = `Звук: ${dirLabels[params.direction ?? "toggle"]}`;
  } else if (rule.intent === "toggle_theme" && params.theme) {
    display = `Тема: ${params.theme}`;
  }

  return { intent: rule.intent, params, confidence, display };
}