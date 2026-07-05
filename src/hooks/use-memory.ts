/**
 * useMemory — React hook wrapping the MemoryStore
 *
 * Provides reactive access to memories with CRUD operations,
 * search, stats, and context string generation.
 */

import { useState, useCallback, useEffect } from "react";
import { memoryStore } from "@/lib/memory-system";
import type { MemoryEntry, MemoryCategory, MemoryStats } from "@/lib/types";

export interface UseMemoryReturn {
  memories: MemoryEntry[];
  addMemory: (content: string, category: MemoryCategory, source?: "auto" | "manual") => void;
  deleteMemory: (id: string) => void;
  updateMemory: (id: string, content: string) => void;
  searchMemory: (query: string) => MemoryEntry[];
  getByCategory: (cat: MemoryCategory) => MemoryEntry[];
  getRecent: (count: number) => MemoryEntry[];
  getContextString: (maxTokens?: number) => string;
  stats: MemoryStats;
  refresh: () => void;
}

export function useMemory(): UseMemoryReturn {
  const [memories, setMemories] = useState<MemoryEntry[]>(() => memoryStore.getAll());

  const refresh = useCallback(() => {
    setMemories(memoryStore.getAll());
  }, []);

  const addMemory = useCallback(
    (content: string, category: MemoryCategory, source: "auto" | "manual" = "manual") => {
      memoryStore.add({
        content: content.trim(),
        category,
        timestamp: new Date().toISOString(),
        source,
      });
      refresh();
    },
    [refresh]
  );

  const deleteMemory = useCallback(
    (id: string) => {
      memoryStore.delete(id);
      refresh();
    },
    [refresh]
  );

  const updateMemory = useCallback(
    (id: string, content: string) => {
      memoryStore.update(id, content);
      refresh();
    },
    [refresh]
  );

  const searchMemory = useCallback((query: string): MemoryEntry[] => {
    return memoryStore.search(query);
  }, []);

  const getByCategory = useCallback((cat: MemoryCategory): MemoryEntry[] => {
    return memoryStore.getByCategory(cat);
  }, []);

  const getRecent = useCallback((count: number): MemoryEntry[] => {
    return memoryStore.getRecent(count);
  }, []);

  const getContextString = useCallback((maxTokens?: number): string => {
    return memoryStore.getForContext(maxTokens);
  }, []);

  const stats: MemoryStats = (() => {
    const byCategory: Record<string, number> = {};
    for (const m of memories) {
      byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    }
    return { total: memories.length, byCategory };
  })();

  // Refresh on mount (in case another tab modified localStorage)
  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    memories,
    addMemory,
    deleteMemory,
    updateMemory,
    searchMemory,
    getByCategory,
    getRecent,
    getContextString,
    stats,
    refresh,
  };
}