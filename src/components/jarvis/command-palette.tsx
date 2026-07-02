/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  PlusCircle,
  Mic,
  Maximize,
  Settings,
  FileText,
  Timer,
  Palette,
  MessageSquarePlus,
} from "lucide-react";
import { playSound } from "@/lib/sounds";

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
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.keywords.some((k) => k.includes(query.toLowerCase()))
      )
    : commands;

  // Reset on open
  const queryRef = useRef("");
  const effectiveQuery = open ? queryRef.current : query;
  useEffect(() => {
    if (open) {
      queryRef.current = "";
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keep selected index in bounds
  const safeIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));

  const execute = useCallback(
    (item: CommandItem) => {
      playSound("activate");
      item.action();
      onClose();
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[safeIndex]) {
          execute(filtered[safeIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, safeIndex, execute, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[safeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-lg border-2 jarvis-border-cyan jarvis-box-glow-strong bg-card/95 p-0 backdrop-blur-xl sm:max-w-md"
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">
          Поиск и выполнение команд JARVIS
        </DialogDescription>

        {/* Search input */}
        <div className="border-b jarvis-border-cyan px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-primary/60 jarvis-glow">$</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Поиск команды…"
              className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            <kbd className="hidden rounded border jarvis-border-cyan bg-muted/50 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:block">
              ESC
            </kbd>
          </div>
        </div>

        {/* Commands list */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto jarvis-scroll p-2"
        >
          {filtered.length === 0 ? (
            <div className="py-8 text-center font-mono text-xs text-muted-foreground/50">
              Команда не найдена
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((item, i) => {
                const Icon = item.icon;
                const isSelected = i === safeIndex;
                return (
                  <button
                    key={item.id}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left font-mono text-xs transition ${
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "text-foreground/80 hover:bg-primary/5"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isSelected ? "text-primary" : "text-muted-foreground/60"
                      }`}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="rounded border border-border/50 bg-muted/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t jarvis-border-cyan px-4 py-2">
          <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground/50">
            <span>
              <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">↑↓</kbd>{" "}
              навигация
            </span>
            <span>
              <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">↵</kbd>{" "}
              выполнить
            </span>
            <span>
              <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5">esc</kbd>{" "}
              закрыть
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Default commands builder — call from page.tsx to get the commands list */
export function buildDefaultCommands(handlers: {
  newConversation: () => void;
  toggleListening: () => void;
  toggleFullscreen: () => void;
  openSettings: () => void;
  toggleNotes: () => void;
  toggleTimer: () => void;
  setTheme: (id: string) => void;
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
  ];
}

export type { CommandItem };