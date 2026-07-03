/**
 * JARVIS Search Index — Client-side fuzzy search engine
 */

export interface SearchResult {
  id: string;
  type: "command" | "message" | "conversation" | "file" | "setting" | "action";
  title: string;
  description?: string;
  icon: string;
  category: string;
  action?: () => void;
  timestamp?: string;
  relevance: number;
}

export interface SearchCategory {
  id: string;
  label: string;
  types: string[];
}

export const SEARCH_CATEGORIES: SearchCategory[] = [
  { id: "all", label: "Все", types: ["command", "message", "conversation", "file", "setting", "action"] },
  { id: "commands", label: "Команды", types: ["command", "action"] },
  { id: "messages", label: "Сообщения", types: ["message"] },
  { id: "files", label: "Файлы", types: ["file"] },
  { id: "settings", label: "Настройки", types: ["setting"] },
];

// ── In-memory index ──────────────────────────────────────────────

const index: Map<string, SearchResult> = new Map();
let nextId = 0;

function genId(): string {
  return `sr_${++nextId}_${Date.now()}`;
}

// ── Index management ─────────────────────────────────────────────

export function addToIndex(
  type: SearchResult["type"],
  item: Omit<SearchResult, "relevance" | "id">
): string {
  const id = genId();
  index.set(id, { ...item, id, relevance: 0 });
  return id;
}

export function addMessages(
  messages: Array<{
    id: string;
    content: string;
    role: string;
    createdAt: string;
  }>
): void {
  for (const m of messages) {
    const key = `msg_${m.id}`;
    index.set(key, {
      id: key,
      type: "message",
      title: m.role === "user" ? "Вы: " : "JARVIS: ",
      description: m.content.slice(0, 120),
      icon: m.role === "user" ? "User" : "Bot",
      category: "Сообщения",
      timestamp: m.createdAt,
      relevance: 0,
    });
  }
}

export function addConversations(
  conversations: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>
): void {
  for (const c of conversations) {
    const key = `convo_${c.id}`;
    index.set(key, {
      id: key,
      type: "conversation",
      title: c.title,
      icon: "MessageSquare",
      category: "Диалоги",
      timestamp: c.updatedAt,
      relevance: 0,
    });
  }
}

export function addFiles(
  files: Array<{
    path: string;
    name: string;
    size: number;
    modified: string;
  }>
): void {
  for (const f of files) {
    const key = `file_${f.path}`;
    // Remove old file entries
    for (const [k, v] of index) {
      if (v.type === "file" && k.startsWith("file_")) index.delete(k);
    }
    index.set(key, {
      id: key,
      type: "file",
      title: f.name,
      description: f.path,
      icon: "File",
      category: "Файлы",
      timestamp: f.modified,
      relevance: 0,
    });
  }
}

export function clearIndex(): void {
  index.clear();
  nextId = 0;
}

// ── Search ────────────────────────────────────────────────────────

function scoreResult(item: SearchResult, queryWords: string[]): number {
  const titleLower = item.title.toLowerCase();
  const descLower = (item.description ?? "").toLowerCase();
  let score = 0;

  for (const word of queryWords) {
    // Exact title match
    if (titleLower === word) score += 10;
    // Title starts with
    else if (titleLower.startsWith(word)) score += 7;
    // Title contains
    else if (titleLower.includes(word)) score += 5;
    // Description contains
    else if (descLower.includes(word)) score += 2;
    else return 0; // Word not found at all → reject
  }

  // Bonus: all words in title
  const allInTitle = queryWords.every((w) => titleLower.includes(w));
  if (allInTitle) score += 3;

  // Bonus: shorter title (more relevant)
  if (titleLower.length < 30) score += 1;

  return score;
}

export function search(
  query: string,
  options?: { types?: string[]; limit?: number }
): SearchResult[] {
  if (!query.trim()) return [];

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return [];

  const allowedTypes = options?.types;
  const limit = options?.limit ?? 20;

  const results: SearchResult[] = [];

  for (const item of index.values()) {
    if (allowedTypes && !allowedTypes.includes(item.type)) continue;

    const score = scoreResult(item, words);
    if (score > 0) {
      results.push({ ...item, relevance: score });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, limit);
}

// ── Recent searches ───────────────────────────────────────────────

const RECENT_KEY = "jarvis-recent-searches";
const MAX_RECENT = 8;

export function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(query: string): void {
  if (typeof window === "undefined") return;
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return;
  try {
    const list = getRecentSearches().filter((s) => s !== trimmed);
    list.unshift(trimmed);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

export function clearRecentSearches(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* ignore */
  }
}