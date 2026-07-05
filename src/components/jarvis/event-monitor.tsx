// ============================================================
// Event Monitor — Real-time event stream viewer
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Pause,
  Play,
  Trash2,
  Download,
  Filter,
} from "lucide-react";
import { useEventLogs } from "@/hooks/use-events";
import { exportEventLogs } from "@/lib/event-logger";
import type { EventLogEntry } from "@/lib/event-logger";

// ── Category color map ────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  chat: "text-cyan-400",
  ai: "text-violet-400",
  tool: "text-amber-400",
  agent: "text-emerald-400",
  voice: "text-pink-400",
  memory: "text-blue-400",
  ui: "text-orange-400",
  system: "text-red-400",
  plugin: "text-purple-400",
};

const CATEGORY_BG: Record<string, string> = {
  chat: "bg-cyan-400/10 border-cyan-400/30",
  ai: "bg-violet-400/10 border-violet-400/30",
  tool: "bg-amber-400/10 border-amber-400/30",
  agent: "bg-emerald-400/10 border-emerald-400/30",
  voice: "bg-pink-400/10 border-pink-400/30",
  memory: "bg-blue-400/10 border-blue-400/30",
  ui: "bg-orange-400/10 border-orange-400/30",
  system: "bg-red-400/10 border-red-400/30",
  plugin: "bg-purple-400/10 border-purple-400/30",
};

function getCategory(event: string): string {
  return event.split(":")[0] ?? "system";
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

function truncateData(data: unknown, max = 80): string {
  const s = JSON.stringify(data);
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

// ── Component ─────────────────────────────────────────────

export function EventMonitor() {
  const { logs, clear } = useEventLogs();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (paused || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs, paused]);

  // Filtered logs
  const filtered = useMemo(() => {
    if (!activeFilter) return logs;
    return logs.filter((l) => getCategory(l.event) === activeFilter);
  }, [logs, activeFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = logs.length;
    // Events per second (over last 10 seconds)
    const now = Date.now();
    const recent = logs.filter((l) => now - l.timestamp < 10_000);
    const eps = recent.length / 10;

    // Most frequent event
    const counts = new Map<string, number>();
    for (const l of logs) {
      counts.set(l.event, (counts.get(l.event) ?? 0) + 1);
    }
    let topEvent = "—";
    let topCount = 0;
    for (const [evt, cnt] of counts) {
      if (cnt > topCount) {
        topEvent = evt;
        topCount = cnt;
      }
    }

    return { total, eps, topEvent, topCount };
  }, [logs]);

  const handleClear = useCallback(() => {
    clear();
  }, [clear]);

  const handleExport = useCallback(
    (fmt: "json" | "csv") => {
      const content = exportEventLogs(fmt);
      const blob = new Blob([content], { type: fmt === "json" ? "application/json" : "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jarvis-events-${Date.now()}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
      setShowExport(false);
    },
    []
  );

  const allCategories = useMemo(
    () => [...new Set(logs.map((l) => getCategory(l.event)))],
    [logs]
  );

  return (
    <div className="flex h-full flex-col gap-2">
      {/* ── Stats bar ── */}
      <div className="flex items-center gap-4 rounded-lg border border-dashed border-primary/20 bg-primary/5 px-3 py-2">
        <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
          Events: <span className="text-foreground">{stats.total}</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
          /s: <span className="text-foreground">{stats.eps.toFixed(1)}</span>
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70 truncate max-w-[200px]">
          Top: <span className="text-foreground">{stats.topEvent}</span>
          {stats.topCount > 0 && (
            <span className="text-muted-foreground/50"> ({stats.topCount})</span>
          )}
        </span>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2">
        {/* Category filters */}
        <div className="relative">
          <button
            onClick={() => setShowExport(!showExport)}
            className={`flex items-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[9px] uppercase tracking-widest transition ${
              showExport
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-jarvis-border-cyan/30 bg-muted/20 text-muted-foreground/70 hover:text-foreground/80"
            }`}
          >
            <Download className="h-3 w-3" />
            Export
          </button>
          {showExport && (
            <div className="absolute left-0 top-full z-50 mt-1 flex flex-col gap-1 rounded-lg border border-primary/20 bg-popover p-1 shadow-xl">
              <button
                onClick={() => handleExport("json")}
                className="rounded px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-widest text-foreground/80 transition hover:bg-primary/10 hover:text-primary"
              >
                JSON
              </button>
              <button
                onClick={() => handleExport("csv")}
                className="rounded px-3 py-1.5 text-left font-mono text-[9px] uppercase tracking-widest text-foreground/80 transition hover:bg-primary/10 hover:text-primary"
              >
                CSV
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-jarvis-border-cyan/30 bg-muted/10 px-1 py-0.5">
          <Filter className="ml-1 h-2.5 w-2.5 text-muted-foreground/50" />
          <button
            onClick={() => setActiveFilter(null)}
            className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider transition ${
              activeFilter === null
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground/50 hover:text-foreground/70"
            }`}
          >
            All
          </button>
          {["chat", "ai", "tool", "agent", "voice", "memory", "ui", "system"].map(
            (cat) => (
              <button
                key={cat}
                onClick={() => setActiveFilter(activeFilter === cat ? null : cat)}
                className={`rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider transition ${
                  activeFilter === cat
                    ? `${CATEGORY_COLORS[cat] ?? "text-foreground"} bg-current/10`
                    : "text-muted-foreground/50 hover:text-foreground/70"
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>

        <div className="flex-1" />

        {/* Pause / Play */}
        <button
          onClick={() => setPaused((p) => !p)}
          className={`flex items-center gap-1 rounded-md border px-2 py-1.5 font-mono text-[9px] uppercase tracking-widest transition ${
            paused
              ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
              : "border-jarvis-border-cyan/30 bg-muted/20 text-muted-foreground/70 hover:text-foreground/80"
          }`}
        >
          {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {paused ? "Resume" : "Pause"}
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          className="flex items-center gap-1 rounded-md border border-jarvis-border-cyan/30 bg-muted/20 px-2 py-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      {/* ── Event stream ── */}
      <div
        ref={scrollRef}
        className="jarvis-scroll flex-1 overflow-y-auto rounded-lg border border-jarvis-border-cyan/20 bg-black/40"
        style={{ maxHeight: "40vh" }}
      >
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10">
            <span className="font-mono text-[10px] text-muted-foreground/40">
              {activeFilter
                ? `No events for "${activeFilter}" category`
                : "Waiting for events..."}
            </span>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {filtered.map((entry) => (
              <EventRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Single event row ──────────────────────────────────────

function EventRow({ entry }: { entry: EventLogEntry }) {
  const cat = getCategory(entry.event);
  const colorClass = CATEGORY_COLORS[cat] ?? "text-foreground";
  const bgClass = CATEGORY_BG[cat] ?? "bg-muted/10 border-border/20";

  return (
    <div className={`flex items-start gap-2 px-3 py-1.5 ${bgClass} border-l-2`}>
      {/* Timestamp */}
      <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50 pt-px">
        {formatTime(entry.timestamp)}
      </span>

      {/* Event name badge */}
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider ${colorClass} bg-current/5`}
      >
        {entry.event}
      </span>

      {/* Data preview */}
      <span className="min-w-0 flex-1 truncate font-mono text-[9px] text-muted-foreground/70 pt-px">
        {truncateData(entry.data)}
      </span>
    </div>
  );
}