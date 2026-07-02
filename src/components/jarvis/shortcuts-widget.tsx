"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Keyboard, ChevronDown, ChevronUp } from "lucide-react";
import { playSound } from "@/lib/sounds";

// ── Types ─────────────────────────────────────────────────────
interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

// ── Data ──────────────────────────────────────────────────────
const categories: ShortcutCategory[] = [
  {
    name: "Общие",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Палитра команд" },
      { keys: ["F11"], description: "Полный экран" },
      { keys: ["Escape"], description: "Закрыть диалоги" },
    ],
  },
  {
    name: "Чат",
    shortcuts: [
      { keys: ["Ctrl", "N"], description: "Новый разговор" },
      { keys: ["Ctrl", "M"], description: "Переключить микрофон" },
    ],
  },
  {
    name: "Инструменты",
    shortcuts: [
      { keys: ["Ctrl", "T"], description: "Переключить таймер" },
      { keys: ["Ctrl", "B"], description: "Переключить калькулятор" },
      { keys: ["Ctrl", "⇧", "N"], description: "Переключить заметки" },
    ],
  },
  {
    name: "Голос",
    shortcuts: [
      { keys: ["Ctrl", "M"], description: "Запустить голосовой ввод" },
    ],
  },
];

const totalShortcuts = categories.reduce((sum, c) => sum + c.shortcuts.length, 0);

// ── Keyboard key element ──────────────────────────────────────
function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary">
      {children}
    </kbd>
  );
}

// ── Main component ────────────────────────────────────────────
export function ShortcutsWidget() {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    playSound("click", 0.3);
    setExpanded((prev) => !prev);
  };

  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Header — always visible, clickable */}
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-between gap-2 text-left transition-colors hover:opacity-80"
        >
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Shortcuts
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!expanded && (
              <span className="font-mono text-[9px] text-muted-foreground">
                {totalShortcuts} shortcuts
              </span>
            )}
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5 text-primary/60" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-primary/60" />
            )}
          </div>
        </button>

        {/* Expandable content */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="shortcuts-list"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3">
                {categories.map((category) => (
                  <div key={category.name}>
                    <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-primary/60">
                      {category.name}
                    </div>
                    <div className="flex flex-col gap-1">
                      {category.shortcuts.map((shortcut) => (
                        <div
                          key={shortcut.keys.join("+")}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, i) => (
                              <span key={i} className="flex items-center gap-1">
                                <Kbd>{key}</Kbd>
                                {i < shortcut.keys.length - 1 && (
                                  <span className="text-[8px] text-primary/40">+</span>
                                )}
                              </span>
                            ))}
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground text-right">
                            {shortcut.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}