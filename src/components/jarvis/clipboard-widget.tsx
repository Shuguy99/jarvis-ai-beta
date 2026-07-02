"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clipboard, Copy, Trash2, ExternalLink, Clock, FileText, Link as LinkIcon } from "lucide-react";
import { playSound } from "@/lib/sounds";

interface ClipboardEntry {
  id: string;
  content: string;
  type: "text" | "url";
  timestamp: number;
}

const MAX_ENTRIES = 20;

function detectType(text: string): "text" | "url" {
  try {
    if (/^https?:\/\//i.test(text.trim())) return "url";
    new URL(text.trim());
    return "url";
  } catch {
    return "text";
  }
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "только что";
  if (diff < 60) return `${diff}с назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`;
  return `${Math.floor(diff / 86400)}д назад`;
}

function truncate(s: string, max = 48): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function ClipboardWidget() {
  const [entries, setEntries] = useState<ClipboardEntry[]>([]);
  const [lastContent, setLastContent] = useState("");
  const [expanded, setExpanded] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);

  // Clipboard monitoring (requires focus / permission)
  const checkClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim() || text === lastContent) return;

      // Dedup: don't add if same content already exists
      setEntries((prev) => {
        if (prev.length > 0 && prev[0].content === text) return prev;
        const entry: ClipboardEntry = {
          id: crypto.randomUUID(),
          content: text.trim(),
          type: detectType(text),
          timestamp: Date.now(),
        };
        const next = [entry, ...prev].slice(0, MAX_ENTRIES);
        return next;
      });
      setLastContent(text);
      playSound("data-received");
    } catch {
      // Clipboard API requires permission or focus — silently ignore
    }
  }, [lastContent]);

  // Monitor clipboard every 2 seconds
  useEffect(() => {
    // Try to read initial clipboard
    void checkClipboard();

    intervalRef.current = setInterval(() => void checkClipboard(), 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkClipboard]);

  // Tick for time-ago refresh
  useEffect(() => {
    timeRef.current = setInterval(() => setTick((t) => t + 1), 15000);
    return () => {
      if (timeRef.current) clearInterval(timeRef.current);
    };
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      playSound("click");
    } catch {
      // ignore
    }
  }, []);

  const removeEntry = useCallback((id: string) => {
    playSound("click");
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    playSound("deactivate");
    setEntries([]);
    setLastContent("");
  }, []);

  const displayed = expanded ? entries : entries.slice(0, 4);
  // Silence unused variable
  void tick;

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clipboard className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Clipboard Intel
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {entries.length > 0 && (
              <button
                onClick={clearAll}
                className="rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 transition hover:text-destructive"
                title="Очистить историю"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
            <span className="font-mono text-[9px] text-muted-foreground/60">
              {entries.length}
            </span>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <Clipboard className="h-6 w-6 text-primary/20" />
            <span className="font-mono text-[10px] text-muted-foreground/60">
              Monitoring clipboard…
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/40">
              Скопируйте текст — он появится здесь
            </span>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {displayed.map((entry, i) => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="group flex items-start gap-2 rounded-lg border border-transparent bg-primary/5 px-2.5 py-2 transition hover:border-primary/20 hover:bg-primary/10"
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {entry.type === "url" ? (
                        <LinkIcon className="h-3 w-3 text-primary/60" />
                      ) : (
                        <FileText className="h-3 w-3 text-primary/60" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] leading-relaxed text-foreground/80 break-all">
                        {truncate(entry.content, 80)}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-muted-foreground/50">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(entry.timestamp)}
                        {entry.type === "url" && (
                          <span className="ml-1 rounded bg-primary/10 px-1 text-primary/60">URL</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => void copyToClipboard(entry.content)}
                        className="rounded p-0.5 text-muted-foreground/50 transition hover:text-primary"
                        title="Копировать"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      {entry.type === "url" && (
                        <a
                          href={entry.content}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-0.5 text-muted-foreground/50 transition hover:text-primary"
                          title="Открыть"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="rounded p-0.5 text-muted-foreground/50 transition hover:text-destructive"
                        title="Удалить"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {entries.length > 4 && (
              <button
                onClick={() => { playSound("click"); setExpanded((v) => !v); }}
                className="mt-2 flex w-full items-center justify-center gap-1 border-t jarvis-border-cyan pt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground transition hover:text-primary"
              >
                {expanded ? "Свернуть" : `Показать ещё (${entries.length - 4})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}