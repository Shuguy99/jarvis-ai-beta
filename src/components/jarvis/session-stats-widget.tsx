

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  MessageSquare,
  Mic,
  Eye,
  Monitor,
  Search,
  Target,
  FileText,
  RotateCcw,
} from "lucide-react";
import { useActivityListener, type ActivityEvent } from "@/components/jarvis/activity-feed";
import { playSound } from "@/lib/sounds";

// ── Types ─────────────────────────────────────────────────────

interface DayStats {
  date: string; // YYYY-MM-DD
  messagesSent: number;
  messagesReceived: number;
  voiceSessions: number;
  imagesAnalyzed: number;
  screenCaptures: number;
  webSearches: number;
  focusMinutes: number;
  notesCreated: number;
}

interface SessionStats {
  days: Record<string, DayStats>;
}

// ── Constants ─────────────────────────────────────────────────

const STORAGE_KEY = "jarvis-session-stats";

const RU_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const SEARCH_PATTERNS = [
  /поиск/i,
  /search/i,
  /найд[ией]/i,
  /google/i,
  /запрос/i,
  /query/i,
];

// ── Helpers ───────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyDay(date: string): DayStats {
  return {
    date,
    messagesSent: 0,
    messagesReceived: 0,
    voiceSessions: 0,
    imagesAnalyzed: 0,
    screenCaptures: 0,
    webSearches: 0,
    focusMinutes: 0,
    notesCreated: 0,
  };
}

function loadStats(): SessionStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionStats;
      if (parsed.days && typeof parsed.days === "object") {
        return parsed;
      }
    }
  } catch {
    /* ignore corrupt data */
  }
  return { days: {} };
}

function saveStats(stats: SessionStats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

function getTodayStats(stats: SessionStats): DayStats {
  const key = todayKey();
  return stats.days[key] ?? emptyDay(key);
}

function getDayOfWeekIndex(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  // Convert: 0=Sun → 6, 1=Mon → 0, ..., 6=Sat → 5
  return day === 0 ? 6 : day - 1;
}

function getLast7DaysDates(): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function isSearchPattern(msg: string): boolean {
  return SEARCH_PATTERNS.some((re) => re.test(msg));
}

// ── Animated number ───────────────────────────────────────────

function AnimatedNumber({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      className="font-mono text-lg font-bold tabular-nums text-primary"
      initial={{ scale: 1.4, opacity: 0.7 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {value}
    </motion.span>
  );
}

// ── Stat card ─────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border jarvis-border-cyan bg-primary/5 p-2">
      <div className="flex items-center justify-center text-muted-foreground/70">
        {icon}
      </div>
      <AnimatedNumber value={value} />
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

// ── Weekly mini chart (SVG) ───────────────────────────────────

function WeeklyChart({ stats }: { stats: SessionStats }) {
  const dates = getLast7DaysDates();
  const today = todayKey();
  const dayIndices = dates.map(getDayOfWeekIndex);

  // Total messages per day (sent + received) for bar height
  const dailyTotals = dates.map((d) => {
    const day = stats.days[d];
    if (!day) return 0;
    return day.messagesSent + day.messagesReceived;
  });

  const maxVal = Math.max(...dailyTotals, 1); // avoid divide by zero

  // Chart dimensions
  const chartW = 196;
  const chartH = 40;
  const barW = 16;
  const gap = (chartW - barW * 7) / 8; // gaps = 8 (sides + between)

  return (
    <div className="mt-3 border-t border-border/30 pt-3">
      <div className="mb-2 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        ── Неделя ──
      </div>
      <div className="flex flex-col items-center">
        <svg
          viewBox={`0 0 ${chartW} ${chartH + 14}`}
          className="w-full max-w-[220px]"
          aria-label="Weekly activity chart"
          role="img"
        >
          {/* Bars */}
          {dates.map((date, i) => {
            const x = gap + i * (barW + gap);
            const ratio = dailyTotals[i] / maxVal;
            const barH = Math.max(ratio * chartH, 2); // minimum 2px so empty days show a sliver
            const y = chartH - barH;
            const isToday = date === today;
            const fill = isToday ? "oklch(0.85 0.19 193)" : "oklch(0.85 0.19 193 / 30%)";
            const filter = isToday
              ? "drop-shadow(0 0 3px oklch(0.85 0.19 193))"
              : "none";

            return (
              <motion.rect
                key={date}
                x={x}
                y={y}
                width={barW}
                height={barH}
                rx={2}
                fill={fill}
                filter={filter}
                initial={{ scaleY: 0, transformOrigin: "bottom" }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.4, delay: i * 0.05, ease: "easeOut" }}
                style={{ transformOrigin: `${x + barW / 2}px ${chartH}px` }}
              />
            );
          })}

          {/* Day labels */}
          {dates.map((date, i) => {
            const x = gap + i * (barW + gap) + barW / 2;
            return (
              <text
                key={date}
                x={x}
                y={chartH + 11}
                textAnchor="middle"
                className="font-mono"
                fill={date === today ? "oklch(0.85 0.19 193)" : "oklch(0.5 0 0 / 40%)"}
                fontSize={7}
              >
                {RU_DAYS[dayIndices[i]]}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function SessionStatsWidget() {
  const [stats, setStats] = useState<SessionStats>(loadStats);
  const resetClicksRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist stats on every change
  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  // ── Track activity events ──────────────────────────────────
  const handleActivity = useCallback((event: ActivityEvent) => {
    setStats((prev) => {
      const key = todayKey();
      const day = { ...(prev.days[key] ?? emptyDay(key)) };
      let changed = false;

      switch (event.category) {
        case "chat": {
          // "info" severity = user sent, "success" = AI replied
          if (event.severity === "info") {
            day.messagesSent++;
            changed = true;
          } else if (event.severity === "success") {
            day.messagesReceived++;
            changed = true;
          }
          // Also detect web searches in chat messages
          if (isSearchPattern(event.message)) {
            day.webSearches++;
            changed = true;
          }
          break;
        }
        case "voice": {
          day.voiceSessions++;
          changed = true;
          break;
        }
        case "vision": {
          if (
            event.message.toLowerCase().includes("screen") ||
            event.message.toLowerCase().includes("скрин") ||
            event.message.toLowerCase().includes("захват")
          ) {
            day.screenCaptures++;
          } else {
            day.imagesAnalyzed++;
          }
          changed = true;
          break;
        }
        case "weather": {
          day.webSearches++;
          changed = true;
          break;
        }
        default:
          break;
      }

      if (!changed) return prev;
      return { ...prev, days: { ...prev.days, [key]: day } };
    });
  }, []);

  useActivityListener(handleActivity);

  // ── Reset (double-click) ───────────────────────────────────
  const handleReset = useCallback(() => {
    resetClicksRef.current++;

    if (resetClicksRef.current === 1) {
      // First click — start timer
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        resetClicksRef.current = 0;
      }, 800);
    } else if (resetClicksRef.current >= 2) {
      // Second click — reset
      resetClicksRef.current = 0;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      playSound("deactivate");
      setStats({ days: {} });
    }
  }, []);

  // ── Today's stats for display ──────────────────────────────
  const today = getTodayStats(stats);

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
        {/* Header */}
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            Session Stats
          </span>
          <button
            onClick={handleReset}
            className="ml-auto rounded p-0.5 text-muted-foreground/30 transition-colors hover:text-rose-400"
            aria-label="Сбросить статистику (двойной клик)"
            title="Двойной клик для сброса"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>

        {/* Stat cards — 2×4 grid on mobile, 4×2 on wider */}
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            value={today.messagesSent}
            label="Сообщ."
          />
          <StatCard
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            value={today.messagesReceived}
            label="Ответы"
          />
          <StatCard
            icon={<Mic className="h-3.5 w-3.5" />}
            value={today.voiceSessions}
            label="Голос"
          />
          <StatCard
            icon={<Eye className="h-3.5 w-3.5" />}
            value={today.imagesAnalyzed}
            label="Визия"
          />
          <StatCard
            icon={<Monitor className="h-3.5 w-3.5" />}
            value={today.screenCaptures}
            label="Экран"
          />
          <StatCard
            icon={<Search className="h-3.5 w-3.5" />}
            value={today.webSearches}
            label="Поиск"
          />
          <StatCard
            icon={<Target className="h-3.5 w-3.5" />}
            value={today.focusMinutes}
            label="Фокус (м)"
          />
          <StatCard
            icon={<FileText className="h-3.5 w-3.5" />}
            value={today.notesCreated}
            label="Заметки"
          />
        </div>

        {/* Weekly mini chart */}
        <WeeklyChart stats={stats} />
      </div>
    </motion.div>
  );
}