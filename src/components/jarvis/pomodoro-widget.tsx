"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Play, Pause, RotateCcw, SkipForward, Flame } from "lucide-react";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type PomodoroMode = "focus" | "shortBreak" | "longBreak";

const DURATIONS: Record<PomodoroMode, number> = {
  focus: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const MODE_COLORS: Record<PomodoroMode, string> = {
  focus: "oklch(0.85 0.19 193)",
  shortBreak: "oklch(0.78 0.16 165)",
  longBreak: "oklch(0.82 0.16 80)",
};

const MODE_LABELS: Record<PomodoroMode, string> = {
  focus: "FOCUS",
  shortBreak: "BREAK",
  longBreak: "LONG BREAK",
};

interface PomodoroStats {
  date: string;
  totalFocusTime: number;
  sessionCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTotalFocus(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadStats(): PomodoroStats {
  try {
    const raw = localStorage.getItem("pomodoro-stats");
    if (raw) {
      const parsed = JSON.parse(raw) as PomodoroStats;
      // Only use stats from today
      if (parsed.date === todayKey()) {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return { date: todayKey(), totalFocusTime: 0, sessionCount: 0 };
}

function saveStats(stats: PomodoroStats) {
  try {
    localStorage.setItem("pomodoro-stats", JSON.stringify(stats));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PomodoroWidget() {
  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(() => loadStats().sessionCount);
  const [totalFocusTime, setTotalFocusTime] = useState(() => loadStats().totalFocusTime);
  const [notification, setNotification] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedAtPauseRef = useRef<number>(0);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist stats whenever they change
  useEffect(() => {
    saveStats({ date: todayKey(), totalFocusTime, sessionCount });
  }, [totalFocusTime, sessionCount]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    };
  }, []);

  // ----- Show inline notification -----
  const showNotification = useCallback((msg: string) => {
    if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
    setNotification(msg);
    notificationTimerRef.current = setTimeout(() => setNotification(null), 3000);
  }, []);

  // ----- Determine next mode -----
  const getNextMode = useCallback(
    (currentMode: PomodoroMode, currentSessions: number): PomodoroMode => {
      if (currentMode === "focus") {
        // After focus, decide break type
        return (currentSessions + 1) % 4 === 0 ? "longBreak" : "shortBreak";
      }
      // After any break, go back to focus
      return "focus";
    },
    []
  );

  // ----- Handle timer tick (called every second) -----
  const tick = useCallback(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        // Timer finished
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsRunning(false);

        // Post-completion logic runs in an effect to avoid setState during render
        return 0;
      }
      return prev - 1;
    });
  }, []);

  // ----- Effect: react when timeLeft hits 0 -----
  useEffect(() => {
    if (timeLeft !== 0 || !isRunning) return;

    // Timer just finished — process completion
    if (mode === "focus") {
      // Count focus session
      const newSessionCount = sessionCount + 1;
      const newTotalFocus = totalFocusTime + DURATIONS.focus;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSessionCount(newSessionCount);
      setTotalFocusTime(newTotalFocus);

      playSound("message-receive");
      addActivityEvent({ severity: "success", category: "system", message: "Фокус-сессия завершена! Отдых." });

      const nextMode = (newSessionCount) % 4 === 0 ? "longBreak" : "shortBreak";
      showNotification(nextMode === "longBreak" ? "Long break — great work!" : "Break time — you earned it!");
      setMode(nextMode);
      setTimeLeft(DURATIONS[nextMode]);
      elapsedAtPauseRef.current = 0;
    } else {
      // Break finished
      playSound("message-receive");
      showNotification("Focus session starting…");
      setMode("focus");
      setTimeLeft(DURATIONS.focus);
      elapsedAtPauseRef.current = 0;
    }
    }, [timeLeft, isRunning, mode, sessionCount, totalFocusTime, showNotification]);

  // ----- Start / Resume -----
  const handleStart = useCallback(() => {
    playSound("activate");
    setIsRunning(true);
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(tick, 1000);
    if (mode === "focus") {
      addActivityEvent({ severity: "info", category: "system", message: "Фокус-сессия начата (25 мин)" });
    } else {
      addActivityEvent({ severity: "info", category: "system", message: "Перерыв начат" });
    }
  }, [tick, mode]);

  // ----- Pause -----
  const handlePause = useCallback(() => {
    playSound("deactivate");
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ----- Reset -----
  const handleReset = useCallback(() => {
    playSound("deactivate");
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    elapsedAtPauseRef.current = 0;
    setTimeLeft(DURATIONS[mode]);
  }, [mode]);

  // ----- Skip to next -----
  const handleSkip = useCallback(() => {
    playSound("click");
    const wasRunning = isRunning;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    elapsedAtPauseRef.current = 0;

    const nextMode = getNextMode(mode, sessionCount);
    setMode(nextMode);
    setTimeLeft(DURATIONS[nextMode]);

    // If it was running and skipping out of focus, don't count the session
    // (session only counts on full completion)
  }, [isRunning, mode, sessionCount, getNextMode]);

  // ----- Switch mode manually (only when not running) -----
  const handleModeSwitch = useCallback(
    (newMode: PomodoroMode) => {
      if (isRunning) return;
      playSound("click");
      setMode(newMode);
      setTimeLeft(DURATIONS[newMode]);
      elapsedAtPauseRef.current = 0;
    },
    [isRunning]
  );

  // ----- Circular progress calculations -----
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const totalDuration = DURATIONS[mode];
  const progress = totalDuration > 0 ? (totalDuration - timeLeft) / totalDuration : 0;
  const offset = circumference * (1 - progress);
  const color = MODE_COLORS[mode];

  // ----- Display session indicator -----
  const currentCycle = sessionCount % 4;

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
      <div className="relative flex flex-col items-center">
        {/* Header */}
        <div className="mb-3 flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Focus Mode
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground/60">
            Session {(currentCycle === 0 && sessionCount > 0 ? 4 : currentCycle === 0 ? 0 : currentCycle)}/4
          </span>
        </div>

        {/* Mode tabs */}
        <div className="mb-4 flex items-center gap-1 rounded border border-border/50 p-0.5">
          {(["focus", "shortBreak", "longBreak"] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeSwitch(m)}
              className={`rounded px-2.5 py-1 font-mono text-[9px] uppercase tracking-wider transition ${
                mode === m
                  ? "text-primary"
                  : "text-muted-foreground/60 hover:text-foreground/80"
              }`}
              style={
                mode === m
                  ? { backgroundColor: `${MODE_COLORS[m]}20`, color: MODE_COLORS[m] }
                  : undefined
              }
            >
              {m === "focus" ? "FOCUS" : m === "shortBreak" ? "BREAK" : "LONG"}
            </button>
          ))}
        </div>

        {/* Circular timer */}
        <div className="relative mb-4 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="oklch(0.82 0.17 193 / 12%)"
              strokeWidth="4"
            />
            {/* Progress circle */}
            <motion.circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.5, ease: "linear" }}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute flex flex-col items-center">
            <span
              className="font-mono text-xl font-bold tabular-nums"
              style={{ color }}
            >
              {formatTime(timeLeft)}
            </span>
            <span
              className="font-mono text-[9px] uppercase tracking-widest"
              style={{ color: `${color}80` }}
            >
              {MODE_LABELS[mode]}
            </span>
          </div>
        </div>

        {/* Session dots */}
        <div className="mb-4 flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full transition-all duration-300"
              style={{
                backgroundColor:
                  i < currentCycle
                    ? MODE_COLORS.focus
                    : i === currentCycle && mode === "focus"
                      ? `${MODE_COLORS.focus}60`
                      : "oklch(0.5 0 0 / 20%)",
                boxShadow:
                  i < currentCycle ? `0 0 4px ${MODE_COLORS.focus}` : "none",
              }}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={isRunning ? handlePause : handleStart}
            className="flex items-center gap-1.5 rounded-lg border jarvis-border-cyan bg-primary/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/20"
          >
            {isRunning ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {isRunning ? "Pause" : "Start"}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-lg border border-muted-foreground/30 bg-muted/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/30 hover:text-primary"
          >
            <RotateCcw className="h-3 w-3" />
          </button>

          <button
            onClick={handleSkip}
            className="flex items-center gap-1.5 rounded-lg border border-muted-foreground/30 bg-muted/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/30 hover:text-primary"
          >
            <SkipForward className="h-3 w-3" />
          </button>
        </div>

        {/* Notification toast (inline) */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="mb-3 w-full rounded-md border jarvis-border-cyan bg-primary/10 px-3 py-1.5 text-center"
            >
              <span className="font-mono text-[10px] tracking-wide text-primary">
                {notification}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats row */}
        <div className="flex w-full items-center justify-between border-t border-border/30 pt-2.5">
          <div className="flex items-center gap-1.5">
            <Flame
              className="h-3 w-3"
              style={{ color: totalFocusTime > 0 ? MODE_COLORS.focus : "oklch(0.5 0 0 / 30%)" }}
            />
            <span className="font-mono text-[9px] text-muted-foreground/60">
              Today&apos;s Focus
            </span>
          </div>
          <span
            className="font-mono text-[10px] font-semibold tabular-nums"
            style={{
              color: totalFocusTime > 0 ? MODE_COLORS.focus : "oklch(0.5 0 0 / 40%)",
            }}
          >
            {totalFocusTime > 0 ? formatTotalFocus(totalFocusTime) : "0m"}
          </span>
        </div>

        {/* Completed sessions stat */}
        <div className="mt-1.5 flex w-full items-center justify-between">
          <span className="font-mono text-[9px] text-muted-foreground/60">
            Completed
          </span>
          <span
            className="font-mono text-[10px] font-semibold tabular-nums"
            style={{
              color: sessionCount > 0 ? MODE_COLORS.focus : "oklch(0.5 0 0 / 40%)",
            }}
          >
            {sessionCount} {sessionCount === 1 ? "session" : "sessions"}
          </span>
        </div>
      </div>
    </div>
  );
}