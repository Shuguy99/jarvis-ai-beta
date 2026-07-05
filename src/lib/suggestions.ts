/**
 * Quick suggestion templates based on context
 * Generates contextual follow-up suggestions for JARVIS responses
 */

export interface Suggestion {
  id: string;
  label: string;
  icon: string; // emoji
}

const TASK_SUGGESTIONS: Suggestion[] = [
  { id: "explain", label: "Объясни подробнее", icon: "💡" },
  { id: "code", label: "Покажи код", icon: "💻" },
  { id: "example", label: "Приведи пример", icon: "📋" },
  { id: "simplify", label: "Проще объясни", icon: "✨" },
  { id: "translate", label: "Переведи на английский", icon: "🌐" },
  { id: "summarize", label: "Сделай краткую выжимку", icon: "📝" },
];

const GREETING_SUGGESTIONS: Suggestion[] = [
  { id: "status", label: "Статус системы", icon: "📊" },
  { id: "weather", label: "Какая погода?", icon: "🌤" },
  { id: "time", label: "Сколько времени?", icon: "⏰" },
  { id: "joke", label: "Расскажи шутку", icon: "😄" },
  { id: "news", label: "Последние новости", icon: "📰" },
  { id: "help", label: "Что ты умеешь?", icon: "❓" },
];

const CODING_SUGGESTIONS: Suggestion[] = [
  { id: "optimize", label: "Оптимизируй код", icon: "⚡" },
  { id: "test", label: "Напиши тесты", icon: "🧪" },
  { id: "debug", label: "Найди баги", icon: "🐛" },
  { id: "doc", label: "Добавь документацию", icon: "📖" },
  { id: "refactor", label: "Рефакторинг", icon: "🔧" },
  { id: "typescript", label: "Конвертируй в TypeScript", icon: "🔷" },
];

const CREATIVE_SUGGESTIONS: Suggestion[] = [
  { id: "story", label: "Напиши историю", icon: "📖" },
  { id: "poem", label: "Стихотворение", icon: "🎭" },
  { id: "brainstorm", label: "Мозговой штурм", icon: "🧠" },
  { id: "rewrite", label: "Перепиши иначе", icon: "✍️" },
  { id: "continue", label: "Продолжи мысль", icon: "➡️" },
  { id: "critique", label: "Дай критику", icon: "🎯" },
];

function detectContext(lastAssistantMessage: string): "task" | "greeting" | "coding" | "creative" | "general" {
  const lower = lastAssistantMessage.toLowerCase();
  const codingKeywords = ["код", "функция", "коде", "программ", "script", "function", "code", "api", "баг", "ошибк", "react", "python", "typescript", "javascript", "css", "html", "алгоритм"];
  const creativeKeywords = ["истори", "стих", "рассказ", "иде", "творч", "story", "poem", "creative", "напиш", "придумай"];

  if (codingKeywords.some(k => lower.includes(k))) return "coding";
  if (creativeKeywords.some(k => lower.includes(k))) return "creative";
  if (lower.length < 100) return "task";
  return "general";
}

export function getSuggestions(lastAssistantMessage: string | null, messageCount: number): Suggestion[] {
  // First message — show greeting suggestions
  if (messageCount <= 1 || !lastAssistantMessage) {
    return GREETING_SUGGESTIONS;
  }

  const context = detectContext(lastAssistantMessage);

  switch (context) {
    case "coding": return CODING_SUGGESTIONS;
    case "creative": return CREATIVE_SUGGESTIONS;
    case "greeting": return GREETING_SUGGESTIONS;
    default: return TASK_SUGGESTIONS;
  }
}

export function expandSuggestion(suggestion: Suggestion): string {
  const map: Record<string, string> = {
    "explain": "Объясни предыдущий ответ более подробно, шаг за шагом.",
    "code": "Покажи практический пример кода для этого.",
    "example": "Приведи наглядный пример из реальной жизни.",
    "simplify": "Объясни то же самое, но проще, как для новичка.",
    "translate": "Переведи предыдущий ответ на английский язык.",
    "summarize": "Сделай краткую выжимку из предыдущего ответа в 3-5 пунктов.",
    "status": "Покажи статус системы: загрузка CPU, память, активные процессы.",
    "weather": "Какая сейчас погода?",
    "time": "Который час? Покажи время в разных часовых поясах.",
    "joke": "Расскажи хорошую шутку про программистов.",
    "news": "Расскажи последние важные новости из мира технологий.",
    "help": "Что ты умеешь? Перечисли все свои возможности.",
    "optimize": "Оптимизируй предыдущий код по производительности.",
    "test": "Напиши юнит-тесты для предыдущего кода.",
    "debug": "Проанализируй предыдущий код и найди потенциальные баги.",
    "doc": "Добавь подробную документацию и комментарии к предыдущему коду.",
    "refactor": "Предложи рефакторинг для предыдущего кода.",
    "typescript": "Конвертируй предыдущий код в TypeScript с типами.",
    "story": "Напиши короткую историю на эту тему.",
    "poem": "Напиши стихотворение на эту тему.",
    "brainstorm": "Проведи мозговой штурм — предложи 10 идей.",
    "rewrite": "Перепиши предыдущий ответ в другом стиле.",
    "continue": "Продолжи развивать эту мысль дальше.",
    "critique": "Дай конструктивную критику предыдущего ответа.",
  };
  return map[suggestion.id] || suggestion.label;
}