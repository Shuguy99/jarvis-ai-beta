"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Server,
  MessageSquare,
  Mic,
  Eye,
  CloudSun,
  Music,
  X,
} from "lucide-react";
import { playSound } from "@/lib/sounds";

// ── Types ─────────────────────────────────────────────────────
type EventSeverity = "info" | "success" | "warning" | "error";
type EventCategory = "system" | "chat" | "voice" | "vision" | "weather" | "media";

export interface ActivityEvent {
  id: string;
  message: string;
  severity: EventSeverity;
  category: EventCategory;
  timestamp: number;
}

// ── Module-level event bus ────────────────────────────────────
const listeners = new Set<(event: ActivityEvent) => void>();

export function addActivityEvent(
  event: Omit<ActivityEvent, "id" | "timestamp">
) {
  const fullEvent: ActivityEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  listeners.forEach((fn) => fn(fullEvent));
}

export function useActivityListener(fn: (event: ActivityEvent) => void) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => {
    const listener = (e: ActivityEvent) => fnRef.current(e);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}

// ── Constants ─────────────────────────────────────────────────
const MAX_EVENTS = 50;

const SEVERITY_COLOR: Record<EventSeverity, string> = {
  info: "text-primary",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-rose-400",
};

const CATEGORY_ICON: Record<
  EventCategory,
  React.ComponentType<React.SVGProps<SVGSVGElement> & { className?: string }>
> = {
  system: Server,
  chat: MessageSquare,
  voice: Mic,
  vision: Eye,
  weather: CloudSun,
  media: Music,
};

const INITIAL_EVENTS: Omit<ActivityEvent, "id" | "timestamp">[] = [
  {
    message: "J.A.R.V.I.S. Core initialized",
    severity: "success",
    category: "system",
  },
  {
    message: "Neural network connection established",
    severity: "info",
    category: "system",
  },
  {
    message: "Voice recognition module loaded",
    severity: "success",
    category: "voice",
  },
  {
    message: "Vision analysis system online",
    severity: "info",
    category: "vision",
  },
  {
    message: "All systems nominal — awaiting input",
    severity: "success",
    category: "system",
  },
];

// ── Helpers ───────────────────────────────────────────────────
function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}с назад`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}м назад`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}ч назад`;
}

// ── Severity dot ──────────────────────────────────────────────
function SeverityDot({ severity }: { severity: EventSeverity }) {
  const colorClass =
    severity === "info"
      ? "bg-primary"
      : severity === "success"
        ? "bg-emerald-400"
        : severity === "warning"
          ? "bg-amber-400"
          : "bg-rose-400";

  return (
    <span
      className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${colorClass}`}
    />
  );
}

// ── Event row ─────────────────────────────────────────────────
function EventRow({ event }: { event: ActivityEvent }) {
  const Icon = CATEGORY_ICON[event.category];
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-start gap-2 border-b border-primary/5 py-1.5 last:border-0"
    >
      <SeverityDot severity={event.severity} />
      <Icon className="mt-0.5 h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
      <div className="min-w-0 flex-1">
        <span
          className={`font-mono text-[10px] leading-relaxed ${SEVERITY_COLOR[event.severity]}/90`}
        >
          {event.message}
        </span>
        <div className="font-mono text-[8px] text-muted-foreground/50">
          {timeAgo(event.timestamp)} · {event.category}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────
export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>(() =>
    INITIAL_EVENTS.map((e) => ({
      ...e,
      id: crypto.randomUUID(),
      timestamp: Date.now() - (INITIAL_EVENTS.length - INITIAL_EVENTS.indexOf(e)) * 2000,
    }))
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  // Listen to external events via the event bus
  useActivityListener(
    useCallback((event: ActivityEvent) => {
      setEvents((prev) => {
        const next = [event, ...prev];
        return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
      });
      playSound("data-received", 0.3);
    }, [])
  );

  // Auto-scroll to top when new event arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events.length]);

  // Force re-render every 10s to update "time ago" labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Periodic simulated events
  useEffect(() => {
    // Every 30s: diagnostics
    const diagId = setInterval(() => {
      addActivityEvent({
        message: "System diagnostics completed — all nominal",
        severity: "success",
        category: "system",
      });
    }, 30_000);

    // Every 60s: network throughput
    const netId = setInterval(() => {
      const mbps = (Math.random() * 200 + 100).toFixed(1);
      addActivityEvent({
        message: `Network throughput stable — ${mbps} Mbps`,
        severity: "info",
        category: "system",
      });
    }, 60_000);

    return () => {
      clearInterval(diagId);
      clearInterval(netId);
    };
  }, []);

  const handleClear = () => {
    playSound("click");
    setEvents([]);
  };

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            Activity Feed
          </span>
          <span className="ml-auto font-mono text-[9px] tabular-nums text-muted-foreground/60">
            {events.length}
          </span>
          {events.length > 0 && (
            <button
              onClick={handleClear}
              className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-rose-400"
              aria-label="Clear activity feed"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Event list */}
        <div
          ref={scrollRef}
          className="jarvis-scroll max-h-48 overflow-y-auto"
        >
          {events.length === 0 ? (
            <div className="flex h-16 items-center justify-center font-mono text-[10px] text-muted-foreground/40">
              No events recorded
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {events.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}