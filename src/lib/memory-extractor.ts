/**
 * Memory Extractor — Rule-based extraction of memorable facts from conversations
 *
 * Uses heuristic regex patterns (NO AI calls) to detect:
 * - User name ("my name is X", "I'm X", "меня зовут X")
 * - Workplace ("I work at Y", "я работаю в Y")
 * - Preferences ("I prefer X", "I like X", "мне нравится X")
 * - Projects ("I'm working on X", "my project does Y")
 * - Instructions ("always use X", "never do Y", "from now on...")
 * - Explicit memory requests ("remember that...", "запомни...")
 */

import type { MemoryCategory } from "@/lib/types";

export interface MemoryCandidate {
  content: string;
  category: MemoryCategory;
  confidence: number; // 0–1
}

// ─── Pattern definitions ──────────────────────────────────────────

interface Pattern {
  regex: RegExp;
  category: MemoryCategory;
  confidence: number;
  /** Extract the memorable content from the match */
  extract: (match: RegExpMatchArray, full: string) => string;
}

const PATTERNS: Pattern[] = [
  // ── Explicit memory requests (highest confidence) ──
  {
    regex: /(?:remember|запомни|запомни(?:ть)?(?:,\s*)?что|запомни(?:ть)?(?:,\s*)?это)\s+(?:that\s+)?(.+?)(?:\.|!|$)/i,
    category: "fact",
    confidence: 0.95,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:remember|запомни(?:ть)?(?:,\s*)?(?:что|это)?)\s+(?:that\s+)?/i, "").trim();
      return cleaned.replace(/[.!]+$/, "").trim();
    },
  },

  // ── Instructions ──
  {
    regex: /(?:always|всегда)\s+(?:use|use the|используй(?:ть)?|приветствуй)\s+(.+)/i,
    category: "instruction",
    confidence: 0.85,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:always|всегда)\s+(?:use\s+(?:the\s+)?|используй(?:ть)?\s+|приветствуй\s+)/i, "").trim();
      return cleaned.replace(/[.!]+$/, "").trim();
    },
  },
  {
    regex: /(?:never|никогда)\s+(?:do|use|say|делай|используй(?:ть)?|говори(?:ть)?)\s+(.+)/i,
    category: "instruction",
    confidence: 0.85,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:never|никогда)\s+(?:do|use|say|делай|используй(?:ть)?|говори(?:ть)?)\s+/i, "").trim();
      return `Never ${cleaned.replace(/[.!]+$/, "").trim()}`;
    },
  },
  {
    regex: /(?:from now on|отныне|сейчас и впредь)\s*,?\s*(.+)/i,
    category: "instruction",
    confidence: 0.8,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:from now on|отныне|сейчас и впредь)\s*,?\s*/i, "").trim();
      return cleaned.replace(/[.!]+$/, "").trim();
    },
  },
  {
    regex: /(?:please\s+)?(?:call me|называй меня|обращайся ко мне)\s+(.+)/i,
    category: "instruction",
    confidence: 0.9,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:please\s+)?(?:call me|называй меня|обращайся ко мне)\s+/i, "").trim();
      return `Call the user "${cleaned.replace(/[.!]+$/, "").trim()}"`;
    },
  },

  // ── Name patterns ──
  {
    regex: /(?:my name is|i'm called|меня зовут|я\s+—\s+|я -)\s+([A-ZА-ЯЁ][a-zа-яё]+(?:\s+[A-ZА-ЯЁ][a-zа-яё]+)*)/i,
    category: "fact",
    confidence: 0.9,
    extract: (m) => `User's name is ${m[1].trim()}`,
  },
  {
    regex: /(?:i am|i'm|я\s+)([A-ZА-ЯЁ][a-zа-яё]+)\b(?!\s+(?:working|doing|going|using|trying|running|building|learning|writing|reading|making|looking|testing|checking|having|getting))\b/i,
    category: "fact",
    confidence: 0.7,
    extract: (m) => `User's name is ${m[1].trim()}`,
  },

  // ── Workplace ──
  {
    regex: /(?:i work at|i work for|я работаю в|я работаю в компании|я работаю на)\s+(.+?)(?:\.|,|!|$)/i,
    category: "fact",
    confidence: 0.85,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:i work at|i work for|я работаю в(?:\s+компании)?|я работаю на)\s+/i, "").trim();
      return `User works at ${cleaned.replace(/[.,!]+$/, "").trim()}`;
    },
  },
  {
    regex: /(?:i'm a|i am a|я\s+(?:(?:являюсь|работаю)\s+)?)(?:software engineer|developer|designer|manager|student|researcher|freelancer|devops|data scientist|product manager|cto|ceo|full-stack|frontend|backend|программист(?:ом)?|разработчик(?:ом)?|дизайнером|менеджером|студентом|студенткой|исследователем|фрилансером|девопс(?:ом)?)\b/i,
    category: "fact",
    confidence: 0.85,
    extract: (m) => `User is a ${m[1]?.trim() || "professional"}`,
  },

  // ── Preferences ──
  {
    regex: /(?:i prefer|i like|i love|i enjoy|мне нравится|я предпочитаю|я люблю|я обожаю|предпочитаю)\s+(.+?)(?:\.|!|$)/i,
    category: "preference",
    confidence: 0.75,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:i prefer|i like|i love|i enjoy|мне нравится|я предпочитаю|я люблю|я обожаю|предпочитаю)\s+/i, "").trim();
      return `User prefers ${cleaned.replace(/[.!]+$/, "").trim()}`;
    },
  },
  {
    regex: /(?:i don't like|i hate|i dislike|мне не нравится|я не люблю|я терпеть не могу)\s+(.+?)(?:\.|!|$)/i,
    category: "preference",
    confidence: 0.8,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:i don't like|i hate|i dislike|мне не нравится|я не люблю|я терпеть не могу)\s+/i, "").trim();
      return `User dislikes ${cleaned.replace(/[.!]+$/, "").trim()}`;
    },
  },
  {
    regex: /(?:my favorite|любимый|любимая|любимое)\s+(.+?)\s+(?:is|—|-|–|это|:\s*)\s*(.+?)(?:\.|!|$)/i,
    category: "preference",
    confidence: 0.8,
    extract: (m) => `User's favorite ${m[1].trim()} is ${m[2].trim().replace(/[.!]+$/, "")}`,
  },

  // ── Project mentions ──
  {
    regex: /(?:i['']?m working on|i['']?m building|i['']?m developing|i['']?m creating|я работаю над|я пишу|я создаю|я разрабатываю)\s+(.+?)(?:\.|!|,|$)/i,
    category: "project",
    confidence: 0.8,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:i['']?m working on|i['']?m building|i['']?m developing|i['']?m creating|я работаю над|я пишу|я создаю|я разрабатываю)\s+/i, "").trim();
      return `User is working on: ${cleaned.replace(/[.,!]+$/, "").trim()}`;
    },
  },
  {
    regex: /(?:my (?:app|project|startup|business|company|сайт|приложение|проект|стартап|бизнес|компания))\s+(?:is called |называется |is |это )\s*(.+?)(?:\.|!|$)/i,
    category: "project",
    confidence: 0.85,
    extract: (_m, full) => {
      const cleaned = full.replace(/^my\s+(?:app|project|startup|business|company|сайт|приложение|проект|стартап|бизнес|компания)\s+(?:is called\s+|называется\s+|is\s+|это\s+)/i, "").trim();
      return `User's project: ${cleaned.replace(/[.!]+$/, "").trim()}`;
    },
  },

  // ── Contextual facts ──
  {
    regex: /(?:i live in|i'm from|я живу в|я из)\s+([A-ZА-ЯЁ][\w\sа-яё]+?)(?:\.|,|!|$)/i,
    category: "context",
    confidence: 0.8,
    extract: (m) => `User is from/lives in ${m[1].trim().replace(/[.,!]+$/, "")}`,
  },
  {
    regex: /(?:i speak|i know|я говорю|я знаю)\s+(.+?)(?:\.|!|$)/i,
    category: "context",
    confidence: 0.75,
    extract: (_m, full) => {
      const cleaned = full.replace(/^(?:i speak|i know|я говорю|я знаю)\s+/i, "").trim();
      return `User speaks/knows ${cleaned.replace(/[.!]+$/, "").trim()}`;
    },
  },
  {
    regex: /(?:my (?:tech stack|stack|язык(?:и)? программирования|стек технологи(?:й|ий)))\s+(?:is|includes|—|-|—|:)\s*(.+?)(?:\.|!|$)/i,
    category: "context",
    confidence: 0.8,
    extract: (m) => `User's tech stack: ${m[1].trim().replace(/[.!]+$/, "")}`,
  },
];

// ─── Main extraction function ─────────────────────────────────────

/**
 * Extract memory candidates from a user message + AI response pair.
 * Returns candidates with confidence scores.
 */
export function extractMemoriesFromMessage(
  userMsg: string,
  _aiResponse: string
): MemoryCandidate[] {
  if (!userMsg || userMsg.trim().length < 5) return [];

  const candidates: MemoryCandidate[] = [];
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    const match = userMsg.match(pattern.regex);
    if (!match) continue;

    const content = pattern.extract(match, userMsg).trim();
    if (!content || content.length < 5 || content.length > 300) continue;

    // Deduplicate similar content
    const normalized = content.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    candidates.push({
      content,
      category: pattern.category,
      confidence: pattern.confidence,
    });
  }

  return candidates;
}

// ─── Suggestion function (lower threshold) ─────────────────────────

/**
 * Return candidates for user confirmation (confidence > 0.4).
 * For auto-save, filter by confidence > 0.7.
 */
export function suggestMemories(
  userMsg: string,
  aiResponse: string
): MemoryCandidate[] {
  const all = extractMemoriesFromMessage(userMsg, aiResponse);
  return all.filter((c) => c.confidence > 0.4);
}

/** Auto-save threshold constant */
export const AUTO_SAVE_THRESHOLD = 0.7;