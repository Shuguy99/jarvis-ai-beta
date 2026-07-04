

import { useEffect, useState, useMemo, useCallback } from "react";
import { useFocusTrap, getOverlayProps } from "@/lib/a11y-utils"
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Clock,
  MessageSquare,
  File,
  Settings,
  Command,
  Play,
  ChevronRight,
  Loader2,
  Radar,
  MessagesSquare,
} from "lucide-react";
import { Command as CmdkCommand } from "cmdk";
import { playSound } from "@/lib/sounds";
import {
  search,
  addRecentSearch,
  getRecentSearches,
  clearRecentSearches,
  SEARCH_CATEGORIES,
  type SearchResult,
  addToIndex,
  addMessages,
  addConversations,
} from "@/lib/search-index";
import { useGlobalSearch } from "@/hooks/use-global-search";

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
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

// ── Type → icon & color mapping ────────────────────────────────────

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Command; color: string; bg: string }
> = {
  command: { icon: Command, color: "text-cyan-400", bg: "bg-cyan-400/10" },
  action: { icon: Play, color: "text-cyan-400", bg: "bg-cyan-400/10" },
  message: {
    icon: MessageSquare,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  conversation: {
    icon: MessagesSquare,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  file: { icon: File, color: "text-green-400", bg: "bg-green-400/10" },
  setting: {
    icon: Settings,
    color: "text-amber-400",
    bg: "bg-amber-400/10",
  },
};

// ── Highlight matching text ────────────────────────────────────────

function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-cyan-300 font-semibold">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Relative time ──────────────────────────────────────────────────

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins}м назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}д назад`;
  return new Date(ts).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

// ── Default actions to index on mount ──────────────────────────────

const DEFAULT_ACTIONS: Array<{
  type: "command" | "action" | "setting";
  title: string;
  description: string;
  icon: string;
  category: string;
  keywords: string[];
}> = [
  {
    type: "command",
    title: "Новый диалог",
    description: "Начать новый разговор с JARVIS",
    icon: "Command",
    category: "Команды",
    keywords: ["новый", "диалог", "чат", "new", "conversation"],
  },
  {
    type: "command",
    title: "Голосовой ввод",
    description: "Включить микрофон для голосовых команд",
    icon: "Command",
    category: "Команды",
    keywords: ["голос", "микрофон", "voice", "mic"],
  },
  {
    type: "command",
    title: "Полный экран",
    description: "Переключить полноэкранный режим",
    icon: "Command",
    category: "Команды",
    keywords: ["полный", "экран", "fullscreen"],
  },
  {
    type: "command",
    title: "Захват экрана",
    description: "Сделать скриншот для анализа",
    icon: "Command",
    category: "Команды",
    keywords: ["скриншот", "экран", "screen", "capture"],
  },
  {
    type: "setting",
    title: "Настройки",
    description: "Открыть панель настроек JARVIS",
    icon: "Settings",
    category: "Настройки",
    keywords: ["настройки", "settings", "параметры", "конфигурация"],
  },
  {
    type: "setting",
    title: "Тема оформления",
    description: "Сменить тему интерфейса (Mark I, 42, 50)",
    icon: "Settings",
    category: "Настройки",
    keywords: ["тема", "theme", "цвет", "оформление", "mark"],
  },
  {
    type: "action",
    title: "Системный монитор",
    description: "Показать CPU, RAM, нагрузку системы",
    icon: "Command",
    category: "Команды",
    keywords: ["система", "монитор", "cpu", "ram", "нагрузка", "system"],
  },
  {
    type: "action",
    title: "Веб-поиск",
    description: "Поиск информации в интернете",
    icon: "Command",
    category: "Команды",
    keywords: ["поиск", "веб", "web", "google", "интернет", "search"],
  },
  {
    type: "setting",
    title: "Горячие клавиши",
    description: "Показать список доступных горячих клавиш",
    icon: "Settings",
    category: "Настройки",
    keywords: ["клавиши", "hotkey", "shortcut", "горячие"],
  },
];

// ── Main Component ─────────────────────────────────────────────────

export default function GlobalSearch({
  open,
  onClose,
  messages,
  conversations,
}: GlobalSearchProps) {
  const trapRef = useFocusTrap(open);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [indexed, setIndexed] = useState(false);

  const {
    results,
    isSearching,
    search: doSearch,
    recentSearches,
    clearRecent,
    loadRecent,
  } = useGlobalSearch();

  // Index default actions + data on open
  useEffect(() => {
    if (!open) return;
    if (indexed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndexed(true);

    for (const item of DEFAULT_ACTIONS) {
      addToIndex(item.type, {
        type: item.type,
        title: item.title,
        description: item.description,
        icon: item.icon,
        category: item.category,
      });
    }

    if (messages && messages.length > 0) {
      addMessages(messages);
    }
    if (conversations && conversations.length > 0) {
      addConversations(conversations);
    }
  }, [open, indexed, messages, conversations]);

  // Reset state on open
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setActiveCategory("all");
      loadRecent();
    }
  }, [open, loadRecent]);

  // Search when query or category changes
  useEffect(() => {
    if (!open) return;
    const types =
      activeCategory === "all"
        ? undefined
        : SEARCH_CATEGORIES.find((c) => c.id === activeCategory)?.types;
    doSearch(query, types);
  }, [query, activeCategory, open, doSearch]);

  // Group results by type
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const typeLabel =
        r.type === "command" || r.type === "action"
          ? "Команды"
          : r.type === "message"
            ? "Сообщения"
            : r.type === "conversation"
              ? "Диалоги"
              : r.type === "file"
                ? "Файлы"
                : r.type === "setting"
                  ? "Настройки"
                  : "Другое";
      if (!map.has(typeLabel)) map.set(typeLabel, []);
      map.get(typeLabel)!.push(r);
    }
    return map;
  }, [results]);

  const handleSelect = useCallback(
    (item: SearchResult) => {
      playSound("activate");
      item.action?.();
      onClose();
    },
    [onClose],
  );

  const handleRecentClick = useCallback((term: string) => {
    setQuery(term);
    playSound("click", 0.15);
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecent();
    clearRecentSearches();
    playSound("click", 0.1);
  }, [clearRecent]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              playSound("deactivate", 0.5);
              onClose();
            }
          }}
        >
          <motion.div
            className="w-full max-w-2xl overflow-hidden rounded-xl jarvis-glass-strong jarvis-border-cyan jarvis-corner-brackets backdrop-blur"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <CmdkCommand
              label="JARVIS Global Search"
              shouldFilter={false}
              loop
            >
              {/* ── Search Input ─────────────────────────────────── */}
              <div className="border-b border-primary/20 px-5 py-4">
                <div className="flex items-center gap-3">
                  <Search className="h-5 w-5 shrink-0 text-primary/60 jarvis-glow" />
                  <CmdkCommand.Input
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Поиск команд, сообщений, файлов…"
                    className="flex-1 bg-transparent font-mono text-base text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-0 focus:outline-none data-[placeholder]:text-muted-foreground/40"
                    autoFocus
                  />
                  {isSearching && (
                    <Loader2 className="h-4 w-4 animate-spin text-primary/70" />
                  )}
                  <button
                    onClick={() => {
                      playSound("deactivate", 0.5);
                      onClose();
                    }}
                    className="rounded-md p-1 text-muted-foreground/50 transition hover:bg-primary/10 hover:text-primary"
                    aria-label="Закрыть"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* ── Category Tabs ────────────────────────────────── */}
              <div className="flex items-center gap-1 border-b border-primary/20 px-4 py-1.5 overflow-x-auto">
                {SEARCH_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setActiveCategory(cat.id);
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

              {/* ── Content Area ─────────────────────────────────── */}
              <CmdkCommand.List className="max-h-[55vh] overflow-y-auto jarvis-scroll p-2">
                {/* Recent searches (empty query) */}
                {!query.trim() && recentSearches.length > 0 && (
                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                        <Clock className="h-3 w-3" />
                        Недавние
                      </span>
                      <button
                        onClick={handleClearRecent}
                        className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground/40 transition hover:text-destructive"
                      >
                        <X className="h-2.5 w-2.5" />
                        Очистить
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {recentSearches.slice(0, 8).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleRecentClick(s)}
                          className="flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {isSearching && query.trim() && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
                    <span className="ml-2 font-mono text-xs text-muted-foreground/50">
                      Сканирование…
                    </span>
                  </div>
                )}

                {/* Empty state (no results, not searching) */}
                {query.trim() && !isSearching && results.length === 0 && (
                  <div className="py-12 text-center">
                    <Radar className="mx-auto mb-3 h-8 w-8 text-muted-foreground/15" />
                    <p className="font-mono text-xs text-muted-foreground/50">
                      Ничего не найдено, сэр
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-muted-foreground/30">
                      Попробуйте другой запрос
                    </p>
                  </div>
                )}

                {/* Grouped results */}
                {query.trim() &&
                  !isSearching &&
                  Array.from(grouped.entries()).map(([groupLabel, items]) => (
                    <CmdkCommand.Group
                      key={groupLabel}
                      heading={
                        <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">
                          {groupLabel}
                          <span className="text-primary/40">({items.length})</span>
                        </span>
                      }
                      className="mb-3"
                    >
                      {items.map((item) => {
                        const config = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.command;
                        const IconComp = config.icon;
                        return (
                          <CmdkCommand.Item
                            key={item.id}
                            value={item.id}
                            onSelect={() => handleSelect(item)}
                            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition data-[selected=true]:bg-primary/15 data-[selected=true]:text-primary [&:not([data-selected=true])]:text-foreground/80 [&:not([data-selected=true])]:hover:bg-primary/5"
                          >
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${config.bg}`}
                            >
                              <IconComp className={`h-4 w-4 ${config.color}`} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-mono text-xs">
                                <HighlightedText
                                  text={item.title}
                                  query={query}
                                />
                              </div>
                              {item.description && (
                                <div className="mt-0.5 truncate font-mono text-[9px] text-muted-foreground/50">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-0.5">
                              {item.timestamp && (
                                <span className="font-mono text-[9px] text-muted-foreground/30">
                                  {relativeTime(item.timestamp)}
                                </span>
                              )}
                              <ChevronRight className="h-3 w-3 text-muted-foreground/20" />
                            </div>
                          </CmdkCommand.Item>
                        );
                      })}
                    </CmdkCommand.Group>
                  ))}
              </CmdkCommand.List>

              {/* ── Footer ───────────────────────────────────────── */}
              <div className="border-t border-primary/20 px-5 py-2.5">
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
                      выбрать
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>
                      <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">
                        Esc
                      </kbd>{" "}
                      закрыть
                    </span>
                  </div>
                </div>
              </div>
            </CmdkCommand>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}