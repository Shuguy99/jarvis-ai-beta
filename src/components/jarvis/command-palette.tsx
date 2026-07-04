

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useFocusTrap, getOverlayProps } from "@/lib/a11y-utils";
import { motion, AnimatePresence } from "framer-motion";
import type {
  PlusCircle} from "lucide-react";
import {
  Mic,
  Maximize,
  Settings,
  FileText,
  Timer,
  Palette,
  MessageSquarePlus,
  Calculator,
  Monitor,
  Ear,
  Search,
  Clock,
  Trash2,
  Command,
  MessageSquare,
  File,
  User,
  Bot,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import {
  addToIndex,
  addMessages,
  addConversations,
  type SearchResult,
  SEARCH_CATEGORIES,
} from "@/lib/search-index";
import { useGlobalSearch } from "@/hooks/use-global-search";

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon: typeof PlusCircle;
  category?: string;
  keywords: string[];
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
  messages?: Array<{
    id: string;
    content: string;
    role: string;
    createdAt: string;
  }>;
  conversations?: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
}

// ── Icon resolver (static switch) ────────────────────────────────

function ResultIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  switch (name) {
    case "MessageSquare":
      return <MessageSquare className={className} />;
    case "User":
      return <User className={className} />;
    case "Bot":
      return <Bot className={className} />;
    case "File":
      return <File className={className} />;
    case "Sparkles":
      return <Sparkles className={className} />;
    default:
      return <Command className={className} />;
  }
}

// ── Component ─────────────────────────────────────────────────────

export function CommandPalette({
  open,
  onClose,
  commands,
  messages,
  conversations,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap(open);

  const {
    results,
    isSearching,
    search: doSearch,
    recentSearches,
    clearRecent,
    loadRecent,
  } = useGlobalSearch();

  // Index commands on mount
  useEffect(() => {
    for (const cmd of commands) {
      addToIndex("command", {
        type: "command",
        title: cmd.label,
        description: cmd.keywords.join(", "),
        icon: "Command",
        category: cmd.category ?? "Commands",
        action: () => {
          playSound("activate");
          cmd.action();
          onClose();
        },
      });
    }
  }, [commands, onClose]);

  // Index messages/conversations when they change
  useEffect(() => {
    if (messages && messages.length > 0) addMessages(messages);
  }, [messages]);

  useEffect(() => {
    if (conversations && conversations.length > 0) addConversations(conversations);
  }, [conversations]);

  // Reset on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setSelectedIndex(0);
      setActiveCategory("all");
      loadRecent();
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open, loadRecent]);

  // Search when query changes
  useEffect(() => {
    if (!open) return;
    const types =
      activeCategory === "all"
        ? undefined
        : SEARCH_CATEGORIES.find((c) => c.id === activeCategory)?.types;
    doSearch(query, types);
  }, [query, activeCategory, open, doSearch]);

  // Combine command-filtered results with search results
  const displayResults = useMemo(() => {
    if (!query.trim()) return [];
    // If search index has results, use those
    if (results.length > 0) return results;
    // Fallback to basic command filtering
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.keywords.some((k) => k.includes(query.toLowerCase()))
      )
      .map((c) => ({
        id: `cmd_${c.id}`,
        type: "command" as const,
        title: c.label,
        icon: "Command",
        category: c.category ?? "Commands",
        relevance: 1,
        action: () => {
          playSound("activate");
          c.action();
          onClose();
        },
      }));
  }, [query, results, commands, onClose]);

  const safeIndex = Math.min(selectedIndex, Math.max(0, displayResults.length - 1));

  const execute = useCallback(
    (item: SearchResult) => {
      playSound("activate");
      item.action?.();
      onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, displayResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (displayResults[safeIndex]) execute(displayResults[safeIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        const cats = SEARCH_CATEGORIES.map((c) => c.id);
        const idx = cats.indexOf(activeCategory);
        setActiveCategory(cats[(idx + 1) % cats.length]);
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        const cats = SEARCH_CATEGORIES.map((c) => c.id);
        const idx = cats.indexOf(activeCategory);
        setActiveCategory(cats[(idx - 1 + cats.length) % cats.length]);
      }
    },
    [displayResults, safeIndex, execute, onClose, activeCategory]
  );

  // Group results by category
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of displayResults) {
      const cat = r.category || "Другое";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(r);
    }
    return map;
  }, [displayResults]);

  let globalIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={trapRef}
            {...getOverlayProps("Command Palette", open)}
            className="w-full max-w-2xl overflow-hidden rounded-xl border-2 jarvis-border-cyan jarvis-box-glow-strong bg-card/95 shadow-2xl backdrop-blur-xl"
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Search input */}
            <div className="border-b jarvis-border-cyan px-5 py-4">
              <div className="flex items-center gap-3">
                <Search className="h-5 w-5 shrink-0 text-primary/60 jarvis-glow" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Поиск команд, сообщений, файлов…"
                  className="flex-1 bg-transparent font-mono text-base text-foreground placeholder:text-muted-foreground/40 outline-none"
                  autoComplete="off"
                />
                {isSearching && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                )}
                <kbd className="hidden rounded border jarvis-border-cyan bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
                  ESC
                </kbd>
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 border-b jarvis-border-cyan px-4 py-1.5 overflow-x-auto">
              {SEARCH_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSelectedIndex(0);
                    playSound("click", 0.15);
                  }}
                  className={`shrink-0 rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-wider transition ${
                    activeCategory === cat.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/60 hover:text-foreground/80 hover:bg-muted/30"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="max-h-[55vh] overflow-y-auto jarvis-scroll">
              {/* Recent searches (when empty query) */}
              {!query.trim() && recentSearches.length > 0 && (
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                      <Clock className="h-3 w-3" />
                      Недавние
                    </span>
                    <button
                      onClick={() => {
                        clearRecent();
                        playSound("click", 0.1);
                      }}
                      className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground/40 transition hover:text-destructive"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      Очистить
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setQuery(s);
                          playSound("click", 0.15);
                        }}
                        className="flex items-center gap-1.5 rounded-md border jarvis-border-cyan bg-primary/5 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                      >
                        <Clock className="h-2.5 w-2.5" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Search results */}
              {query.trim() && (
                <div className="p-2">
                  {displayResults.length === 0 && !isSearching ? (
                    <div className="py-12 text-center">
                      <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/20" />
                      <p className="font-mono text-xs text-muted-foreground/50">
                        Ничего не найдено
                      </p>
                      <p className="mt-1 font-mono text-[9px] text-muted-foreground/30">
                        Попробуйте другой запрос
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Array.from(grouped.entries()).map(
                        ([category, items]) => (
                          <div key={category}>
                            <div className="mb-1 px-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                              {category} ({items.length})
                            </div>
                            {items.map((item) => {
                              const idx = globalIdx++;
                              const isSelected = idx === safeIndex;
                              return (
                                <motion.button
                                  key={item.id}
                                  initial={{ opacity: 0, x: -4 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.1 }}
                                  onClick={() => execute(item)}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                                    isSelected
                                      ? "bg-primary/15 text-primary"
                                      : "text-foreground/80 hover:bg-primary/5"
                                  }`}
                                >
                                  <ResultIcon
                                    name={item.icon}
                                    className={`h-4 w-4 shrink-0 ${
                                      isSelected
                                        ? "text-primary"
                                        : "text-muted-foreground/50"
                                    }`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-mono text-xs">
                                      {item.title}
                                    </div>
                                    {item.description && (
                                      <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground/50">
                                        {item.description}
                                      </div>
                                    )}
                                  </div>
                                  {item.timestamp && (
                                    <span className="shrink-0 font-mono text-[9px] text-muted-foreground/30">
                                      {new Date(item.timestamp).toLocaleTimeString(
                                        "ru-RU",
                                        { hour: "2-digit", minute: "2-digit" }
                                      )}
                                    </span>
                                  )}
                                  {isSelected && (
                                    <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                                  )}
                                </motion.button>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t jarvis-border-cyan px-5 py-2.5">
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground/40">
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">
                      ↑↓
                    </kbd>{" "}
                    навигация
                  </span>
                  <span>
                    <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">
                      ↵
                    </kbd>{" "}
                    открыть
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span>
                    <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">
                      Tab
                    </kbd>{" "}
                    категория
                  </span>
                  <span>
                    <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">
                      esc
                    </kbd>{" "}
                    закрыть
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Default commands builder — call from page.tsx */
export function buildDefaultCommands(handlers: {
  newConversation: () => void;
  toggleListening: () => void;
  toggleFullscreen: () => void;
  openSettings: () => void;
  toggleNotes: () => void;
  toggleTimer: () => void;
  setTheme: (id: string) => void;
  toggleCalculator?: () => void;
  captureScreen?: () => void;
  toggleWakeWord?: () => void;
}): CommandItem[] {
  return [
    {
      id: "new-convo",
      label: "Новый диалог",
      shortcut: "Ctrl+N",
      icon: MessageSquarePlus,
      category: "Chat",
      keywords: ["новый", "диалог", "чат", "new", "conversation"],
      action: handlers.newConversation,
    },
    {
      id: "voice",
      label: "Голосовой ввод",
      shortcut: "Ctrl+M",
      icon: Mic,
      category: "Voice",
      keywords: ["голос", "микрофон", "voice", "mic"],
      action: handlers.toggleListening,
    },
    {
      id: "fullscreen",
      label: "Полный экран",
      shortcut: "F11",
      icon: Maximize,
      category: "View",
      keywords: ["полный", "экран", "fullscreen"],
      action: handlers.toggleFullscreen,
    },
    {
      id: "settings",
      label: "Настройки",
      icon: Settings,
      category: "System",
      keywords: ["настройки", "settings", "параметры"],
      action: handlers.openSettings,
    },
    {
      id: "notes",
      label: "Заметки",
      icon: FileText,
      category: "Tools",
      keywords: ["заметки", "notes", "todo", "задачи"],
      action: handlers.toggleNotes,
    },
    {
      id: "timer",
      label: "Таймер",
      icon: Timer,
      category: "Tools",
      keywords: ["таймер", "timer", "секундомер", "stopwatch"],
      action: handlers.toggleTimer,
    },
    {
      id: "theme-mark1",
      label: "Тема: Mark I",
      icon: Palette,
      category: "Theme",
      keywords: ["тема", "mark", "mark1", "mark i", "костюм"],
      action: () => handlers.setTheme("mark1"),
    },
    {
      id: "theme-mark42",
      label: "Тема: Mark 42",
      icon: Palette,
      category: "Theme",
      keywords: ["тема", "mark42", "mark 42", "золотой", "gold"],
      action: () => handlers.setTheme("mark42"),
    },
    {
      id: "theme-mark50",
      label: "Тема: Mark 50",
      icon: Palette,
      category: "Theme",
      keywords: ["тема", "mark50", "mark 50", "красный", "red"],
      action: () => handlers.setTheme("mark50"),
    },
    ...(handlers.toggleCalculator
      ? [
          {
            id: "calculator",
            label: "Калькулятор",
            icon: Calculator,
            category: "Tools",
            keywords: ["калькулятор", "calculator", "посчитать"],
            action: handlers.toggleCalculator,
          },
        ]
      : []),
    ...(handlers.captureScreen
      ? [
          {
            id: "screen-capture",
            label: "Захват экрана",
            icon: Monitor,
            category: "Vision",
            keywords: ["скриншот", "экран", "screen", "capture", "захват"],
            action: handlers.captureScreen,
          },
        ]
      : []),
    ...(handlers.toggleWakeWord
      ? [
          {
            id: "wake-word",
            label: "Wake Word",
            icon: Ear,
            category: "Voice",
            keywords: ["wake", "hey jarvis", "пробуждение", "слово"],
            action: handlers.toggleWakeWord,
          },
        ]
      : []),
  ];
}

export type { CommandItem };