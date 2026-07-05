import { useState, useMemo, useCallback, useRef } from "react";
import {
  Brain,
  Search,
  Trash2,
  Plus,
  Download,
  Upload,
  Settings,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemory } from "@/hooks/use-memory";
import { memoryStore } from "@/lib/memory-system";
import type { MemoryCategory, MemoryEntry } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────

interface MemoryPanelProps {
  open: boolean;
  onClose: () => void;
}

// ── Constants ──────────────────────────────────────────────────────

const CATEGORIES: { key: MemoryCategory; label: string; emoji: string }[] = [
  { key: "preference", label: "Preferences", emoji: "⭐" },
  { key: "fact", label: "Facts", emoji: "📝" },
  { key: "context", label: "Context", emoji: "🌍" },
  { key: "instruction", label: "Instructions", emoji: "📋" },
  { key: "project", label: "Projects", emoji: "🚀" },
];

const CATEGORY_COLORS: Record<MemoryCategory, string> = {
  preference: "border-l-amber-400/70",
  fact: "border-l-cyan-400/70",
  context: "border-l-emerald-400/70",
  instruction: "border-l-rose-400/70",
  project: "border-l-violet-400/70",
};

// ── Component ──────────────────────────────────────────────────────

export function MemoryPanel({ open, onClose }: MemoryPanelProps) {
  const {
    memories,
    addMemory,
    deleteMemory,
    updateMemory,
    searchMemory,
    stats,
    refresh,
  } = useMemory();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<MemoryCategory | "all">("all");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryCategory>("fact");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [autoExtract, setAutoExtract] = useState(() => {
    try {
      return localStorage.getItem("jarvis-memory-auto-extract") !== "false";
    } catch {
      return true;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered memories
  const filtered = useMemo(() => {
    let result = memories;

    if (searchQuery.trim()) {
      result = searchMemory(searchQuery);
    }

    if (activeCategory !== "all") {
      result = result.filter((m) => m.category === activeCategory);
    }

    return result;
  }, [memories, searchQuery, activeCategory, searchMemory]);

  // Grouped by category
  const grouped = useMemo(() => {
    const groups: Record<string, MemoryEntry[]> = {};
    for (const m of filtered) {
      if (!groups[m.category]) groups[m.category] = [];
      groups[m.category].push(m);
    }
    // Sort each group by timestamp desc
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    return groups;
  }, [filtered]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    if (!newContent.trim()) return;
    addMemory(newContent.trim(), newCategory);
    setNewContent("");
    setShowAddForm(false);
  }, [newContent, newCategory, addMemory]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMemory(id);
    },
    [deleteMemory]
  );

  const handleStartEdit = useCallback((m: MemoryEntry) => {
    setEditingId(m.id);
    setEditContent(m.content);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingId && editContent.trim()) {
      updateMemory(editingId, editContent.trim());
      setEditingId(null);
      setEditContent("");
    }
  }, [editingId, editContent, updateMemory]);

  const handleExport = useCallback(() => {
    const json = memoryStore.exportMemories();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-memories-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        memoryStore.importMemories(reader.result as string);
        refresh();
      };
      reader.readAsText(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [refresh]
  );

  const handleToggleAutoExtract = useCallback(() => {
    const next = !autoExtract;
    setAutoExtract(next);
    try {
      localStorage.setItem("jarvis-memory-auto-extract", String(next));
    } catch {
      /* ignore */
    }
  }, [autoExtract]);

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString("ru-RU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return ts;
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        transition={{ duration: 0.2 }}
        className="fixed right-0 top-0 h-full w-full max-w-md z-50
          bg-gray-950/95 backdrop-blur-xl border-l border-cyan-500/20
          flex flex-col shadow-2xl shadow-cyan-500/5"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-semibold text-cyan-300 tracking-wider uppercase">
              Memory Bank
            </h2>
            <span className="text-xs text-gray-500 ml-1">({stats.total})</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleExport}
              className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-gray-400 hover:text-cyan-400 transition-colors"
              title="Export"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handleImport}
              className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-gray-400 hover:text-cyan-400 transition-colors"
              title="Import"
            >
              <Upload className="w-4 h-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-cyan-500/10 text-gray-400 hover:text-cyan-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Search & Controls ── */}
        <div className="px-4 py-3 border-b border-gray-800/50 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search memories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-900/60 border border-gray-700/50
                  rounded-lg text-gray-200 placeholder-gray-500
                  focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20
                  transition-colors"
              />
            </div>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-colors"
              title="Add memory"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Auto-extract toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 flex items-center gap-1.5">
              <Settings className="w-3 h-3" />
              Auto-extract from chat
            </label>
            <button
              onClick={handleToggleAutoExtract}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                autoExtract ? "bg-cyan-500/60" : "bg-gray-700"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  autoExtract ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          {/* Add form */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-1">
                  <textarea
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="What should JARVIS remember?"
                    rows={2}
                    className="w-full px-3 py-1.5 text-xs bg-gray-900/60 border border-gray-700/50
                      rounded-lg text-gray-200 placeholder-gray-500 resize-none
                      focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAdd();
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as MemoryCategory)}
                      className="flex-1 px-2 py-1 text-xs bg-gray-900/60 border border-gray-700/50
                        rounded-lg text-gray-300 focus:outline-none focus:border-cyan-500/50"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.emoji} {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleAdd}
                      disabled={!newContent.trim()}
                      className="px-3 py-1 text-xs font-medium rounded-lg
                        bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30
                        disabled:opacity-30 disabled:cursor-not-allowed
                        transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Category tabs ── */}
        <div className="flex gap-1 px-4 py-2 border-b border-gray-800/50 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
              activeCategory === "all"
                ? "bg-cyan-500/20 text-cyan-400"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
            }`}
          >
            All ({stats.total})
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                activeCategory === c.key
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
              }`}
            >
              {c.emoji} {c.label} ({stats.byCategory[c.key] || 0})
            </button>
          ))}
        </div>

        {/* ── Memory list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Brain className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-xs">
                {searchQuery ? "No memories match your search" : "No memories yet"}
              </p>
              <p className="text-xs mt-1 text-gray-700">
                {searchQuery ? "Try a different query" : "JARVIS will remember things you share"}
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => {
              const catInfo = CATEGORIES.find((c) => c.key === category);
              return (
                <div key={category}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-xs">{catInfo?.emoji}</span>
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      {catInfo?.label || category}
                    </span>
                    <span className="text-xs text-gray-600">({items.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((m) => (
                      <div
                        key={m.id}
                        className={`group relative px-3 py-2 rounded-lg bg-gray-900/40 border-l-2
                          ${CATEGORY_COLORS[m.category as MemoryCategory] || "border-l-gray-600"}
                          hover:bg-gray-900/70 transition-colors`}
                      >
                        {editingId === m.id ? (
                          <div className="flex items-start gap-1.5">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={2}
                              className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-cyan-500/30
                                rounded text-gray-200 resize-none
                                focus:outline-none focus:border-cyan-500/50"
                              autoFocus
                            />
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={handleSaveEdit}
                                className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditContent("");
                                }}
                                className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-gray-200 leading-relaxed pr-6">
                              {m.content}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-gray-600">
                                {formatDate(m.timestamp)}
                              </span>
                              {m.source === "auto" && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-500/60">
                                  auto
                                </span>
                              )}
                            </div>
                            <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(m)}
                                className="p-1 rounded hover:bg-cyan-500/10 text-gray-500 hover:text-cyan-400"
                                title="Edit"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(m.id)}
                                className="p-1 rounded hover:bg-rose-500/10 text-gray-500 hover:text-rose-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Stats footer ── */}
        <div className="px-4 py-2 border-t border-gray-800/50 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-gray-600">
            <span>{stats.total} / 500 memories used</span>
            <span>
              {CATEGORIES.filter((c) => (stats.byCategory[c.key] || 0) > 0)
                .map((c) => `${c.emoji}${stats.byCategory[c.key] || 0}`)
                .join(" ")}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}