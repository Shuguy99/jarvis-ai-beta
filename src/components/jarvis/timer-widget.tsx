

import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, RotateCcw, Timer, Clock, AlarmClock } from "lucide-react";
import { playSound } from "@/lib/sounds";

export type TimerMode = "timer" | "stopwatch";
export type TimerState = "idle" | "running" | "paused" | "finished";

export interface TimerHandle {
  startTimer: (seconds: number) => void;
  startStopwatch: () => void;
  stop: () => void;
  reset: () => void;
  timerState: TimerState;
}

function pad2(n: number) {
  return String(Math.floor(n)).padStart(2, "0");
}

export const TimerWidget = forwardRef<TimerHandle>((_props, ref) => {
  const [mode, setMode] = useState<TimerMode>("timer");
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [inputMin, setInputMin] = useState("5");
  const [inputSec, setInputSec] = useState("0");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTsRef = useRef<number>(0);
  const baseRef = useRef<number>(0);
  const onFinishedRef = useRef<(() => void) | null>(null);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    const now = Date.now();
    const delta = now - startTsRef.current;

    if (mode === "timer") {
      const newRemaining = baseRef.current - delta;
      if (newRemaining <= 0) {
        setRemainingMs(0);
        setTimerState("finished");
        clearTick();
        playSound("timer-alarm");
        onFinishedRef.current?.();
        return;
      }
      setRemainingMs(newRemaining);
    } else {
      setElapsedMs(baseRef.current + delta);
    }
  }, [mode, clearTick]);

  const startTimer = useCallback(
    (seconds: number) => {
      clearTick();
      const ms = seconds * 1000;
      setMode("timer");
      setTotalSeconds(seconds);
      setRemainingMs(ms);
      setElapsedMs(0);
      setTimerState("running");
      startTsRef.current = Date.now();
      baseRef.current = ms;
      onFinishedRef.current = () => {
        // Speak "Время вышло, сэр" using browser SpeechSynthesis
        try {
          const synth = window.speechSynthesis;
          if (synth) {
            const utt = new SpeechSynthesisUtterance("Время вышло, сэр");
            utt.lang = "ru-RU";
            utt.rate = 1.0;
            utt.pitch = 0.9;
            synth.speak(utt);
          }
        } catch {
          /* ignore */
        }
      };
      intervalRef.current = setInterval(tick, 100);
      playSound("activate");
    },
    [clearTick, tick]
  );

  const startStopwatch = useCallback(() => {
    clearTick();
    setMode("stopwatch");
    setTotalSeconds(0);
    setRemainingMs(0);
    setElapsedMs(0);
    setTimerState("running");
    startTsRef.current = Date.now();
    baseRef.current = 0;
    intervalRef.current = setInterval(tick, 100);
    playSound("activate");
  }, [clearTick, tick]);

  const pause = useCallback(() => {
    if (timerState !== "running") return;
    clearTick();
    const now = Date.now();
    const delta = now - startTsRef.current;
    baseRef.current = mode === "timer" ? baseRef.current - delta : baseRef.current + delta;
    setTimerState("paused");
    playSound("deactivate");
  }, [timerState, mode, clearTick]);

  const resume = useCallback(() => {
    if (timerState !== "paused") return;
    startTsRef.current = Date.now();
    setTimerState("running");
    intervalRef.current = setInterval(tick, 100);
    playSound("mic-on");
  }, [timerState, tick]);

  const reset = useCallback(() => {
    clearTick();
    setTimerState("idle");
    setRemainingMs(0);
    setElapsedMs(0);
    setTotalSeconds(0);
    onFinishedRef.current = null;
    playSound("deactivate");
  }, [clearTick]);

  const stop = useCallback(() => {
    clearTick();
    setTimerState("idle");
    onFinishedRef.current = null;
    playSound("deactivate");
  }, [clearTick]);

  const handleStartFromUI = useCallback(() => {
    if (timerState === "finished") {
      reset();
      return;
    }
    if (mode === "timer") {
      const mins = parseInt(inputMin) || 0;
      const secs = parseInt(inputSec) || 0;
      const total = mins * 60 + secs;
      if (total <= 0) return;
      startTimer(total);
    } else {
      startStopwatch();
    }
  }, [timerState, mode, inputMin, inputSec, startTimer, startStopwatch, reset]);

  // Display time
  const displayMs = mode === "timer" ? remainingMs : elapsedMs;
  const totalDisplaySec = displayMs / 1000;
  const hrs = Math.floor(totalDisplaySec / 3600);
  const mins = Math.floor((totalDisplaySec % 3600) / 60);
  const secs = Math.floor(totalDisplaySec % 60);
  const ms = Math.floor((displayMs % 1000) / 10);

  const displayStr = hrs > 0
    ? `${pad2(hrs)}:${pad2(mins)}:${pad2(secs)}.${pad2(ms)}`
    : `${pad2(mins)}:${pad2(secs)}.${pad2(ms)}`;

  // Progress for timer mode
  const progress =
    mode === "timer" && totalSeconds > 0
      ? 1 - remainingMs / (totalSeconds * 1000)
      : 0;

  useImperativeHandle(ref, () => ({
    startTimer,
    startStopwatch,
    stop,
    reset,
    timerState,
  }), [startTimer, startStopwatch, stop, reset, timerState]);

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="relative">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {timerState === "finished" ? (
              <AlarmClock className="h-4 w-4 text-primary anim-pulse-glow" />
            ) : mode === "timer" ? (
              <Timer className="h-4 w-4 text-primary anim-data-pulse" />
            ) : (
              <Clock className="h-4 w-4 text-primary anim-data-pulse" />
            )}
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary jarvis-glow">
              {timerState === "finished"
                ? "Finished"
                : timerState === "running"
                  ? "Running"
                  : timerState === "paused"
                    ? "Paused"
                    : mode === "timer"
                      ? "Timer"
                      : "Stopwatch"}
            </span>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded border jarvis-border-cyan p-0.5">
            <button
              onClick={() => {
                if (timerState === "idle") {
                  setMode("timer");
                  playSound("click");
                }
              }}
              className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition ${
                mode === "timer"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Timer
            </button>
            <button
              onClick={() => {
                if (timerState === "idle") {
                  setMode("stopwatch");
                  playSound("click");
                }
              }}
              className={`rounded px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider transition ${
                mode === "stopwatch"
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SW
            </button>
          </div>
        </div>

        {/* Large time display */}
        <div className="mb-3 flex items-center justify-center py-3">
          <span
            className={`font-mono text-3xl tabular-nums tracking-wider transition ${
              timerState === "finished"
                ? "text-primary anim-pulse-glow jarvis-glow-strong"
                : timerState === "running"
                  ? "text-primary jarvis-glow"
                  : timerState === "paused"
                    ? "text-primary/70"
                    : "text-foreground/60"
            }`}
          >
            {displayStr}
          </span>
        </div>

        {/* Progress bar (timer mode) */}
        {mode === "timer" && totalSeconds > 0 && timerState !== "idle" && (
          <div className="mb-3 h-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-primary/70 transition-all duration-100"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        )}

        {/* Timer input (idle state) */}
        {mode === "timer" && timerState === "idle" && (
          <div className="mb-3 flex items-center justify-center gap-2">
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="99"
                value={inputMin}
                onChange={(e) => setInputMin(e.target.value)}
                className="w-10 bg-primary/10 text-center font-mono text-sm text-primary outline-none rounded border jarvis-border-cyan py-0.5"
              />
              <span className="font-mono text-[10px] text-muted-foreground">min</span>
            </div>
            <span className="font-mono text-lg text-muted-foreground">:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="59"
                value={inputSec}
                onChange={(e) => setInputSec(e.target.value)}
                className="w-10 bg-primary/10 text-center font-mono text-sm text-primary outline-none rounded border jarvis-border-cyan py-0.5"
              />
              <span className="font-mono text-[10px] text-muted-foreground">sec</span>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          {timerState === "running" ? (
            <button
              onClick={pause}
              className="flex items-center gap-1.5 rounded-lg border jarvis-border-cyan bg-primary/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/20"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </button>
          ) : timerState === "paused" ? (
            <button
              onClick={resume}
              className="flex items-center gap-1.5 rounded-lg border jarvis-border-cyan bg-primary/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/20"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          ) : (
            <button
              onClick={handleStartFromUI}
              className="flex items-center gap-1.5 rounded-lg border jarvis-border-cyan bg-primary/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/20"
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </button>
          )}

          {(timerState !== "idle") && (
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg border border-muted-foreground/30 bg-muted/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/30 hover:text-primary"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

TimerWidget.displayName = "TimerWidget";