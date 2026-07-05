/**
 * Memory System — Long-term memory store for JARVIS
 *
 * Stores user facts, preferences, context, instructions, and project info
 * in localStorage. Persists across sessions.
 */

import type { MemoryEntry, MemoryCategory, MemoryStats } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────

const STORAGE_KEY = "jarvis-memories";
const MAX_MEMORIES = 500;

/** Approximate tokens: 1 token ≈ 4 chars for English, ~2.5 chars for Russian */
const CHARS_PER_TOKEN = 3.5;

// ─── Singleton ────────────────────────────────────────────────────

class MemoryStore {
  private memories: MemoryEntry[] = [];

  constructor() {
    this.load();
  }

  // ─── Persistence ───────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          this.memories = parsed as MemoryEntry[];
        }
      }
    } catch {
      this.memories = [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.memories));
    } catch {
      // Storage full or unavailable — silently fail
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────

  add(memory: Omit<MemoryEntry, "id">): void {
    const entry: MemoryEntry = {
      ...memory,
      id: this.generateId(),
    };
    this.memories.push(entry);

    // FIFO eviction when limit reached
    if (this.memories.length > MAX_MEMORIES) {
      this.memories = this.memories.slice(-MAX_MEMORIES);
    }

    this.persist();
  }

  search(query: string): MemoryEntry[] {
    const lower = query.toLowerCase();
    return this.memories.filter((m) => m.content.toLowerCase().includes(lower));
  }

  getAll(): MemoryEntry[] {
    return [...this.memories];
  }

  delete(id: string): void {
    this.memories = this.memories.filter((m) => m.id !== id);
    this.persist();
  }

  update(id: string, content: string): void {
    const idx = this.memories.findIndex((m) => m.id === id);
    if (idx >= 0) {
      this.memories[idx] = {
        ...this.memories[idx],
        content,
        timestamp: new Date().toISOString(),
      };
      this.persist();
    }
  }

  getByCategory(cat: MemoryCategory): MemoryEntry[] {
    return this.memories.filter((m) => m.category === cat);
  }

  getRecent(count: number): MemoryEntry[] {
    return this.memories.slice(-count).reverse();
  }

  // ─── Context formatting ────────────────────────────────────────

  /**
   * Format memories into a system prompt context string.
   * Truncates to fit within the token budget.
   */
  getForContext(maxTokens: number = 500): string {
    if (this.memories.length === 0) return "";

    const maxChars = Math.floor(maxTokens * CHARS_PER_TOKEN);

    // Prioritize: instructions first, then preferences, then facts, context, projects
    const priority: MemoryCategory[] = ["instruction", "preference", "fact", "context", "project"];
    const sorted = [...this.memories].sort((a, b) => {
      return priority.indexOf(a.category) - priority.indexOf(b.category);
    });

    const lines: string[] = ["[ПАМЯТЬ JARVIS — известная информация о пользователе]"];

    let totalChars = lines[0].length + 1;

    for (const mem of sorted) {
      const line = `[${mem.category.toUpperCase()}] ${mem.content}`;
      const lineLen = line.length + 1; // +1 for newline
      if (totalChars + lineLen > maxChars) break;
      lines.push(line);
      totalChars += lineLen;
    }

    if (lines.length <= 1) return "";

    lines.push("Используй эту информацию для персонализации ответов.");
    return lines.join("\n");
  }

  // ─── Import / Export ────────────────────────────────────────────

  exportMemories(): string {
    return JSON.stringify(this.memories, null, 2);
  }

  importMemories(json: string): void {
    try {
      const parsed = JSON.parse(json) as unknown;
      if (!Array.isArray(parsed)) return;

      const entries = parsed as MemoryEntry[];
      const valid = entries.filter(
        (e) =>
          typeof e.content === "string" &&
          e.content.trim().length > 0 &&
          typeof e.category === "string"
      );

      // Assign new IDs to avoid collisions
      for (const entry of valid) {
        entry.id = this.generateId();
        if (!entry.timestamp) entry.timestamp = new Date().toISOString();
        if (!entry.source) entry.source = "manual";
      }

      this.memories = [...this.memories, ...valid].slice(-MAX_MEMORIES);
      this.persist();
    } catch {
      // Invalid JSON — silently fail
    }
  }

  // ─── Stats ──────────────────────────────────────────────────────

  getStats(): MemoryStats {
    const byCategory: Record<string, number> = {};
    for (const m of this.memories) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    }
    return { total: this.memories.length, byCategory };
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private generateId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

// Singleton instance
export const memoryStore = new MemoryStore();