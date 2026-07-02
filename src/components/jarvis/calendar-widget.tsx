"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { playSound } from "@/lib/sounds";

// ---------------------------------------------------------------------------
// Types & Helpers
// ---------------------------------------------------------------------------

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

interface CalendarEvents {
  [dateKey: string]: string[];
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function loadEvents(): CalendarEvents {
  try {
    const raw = localStorage.getItem("jarvis-calendar-events");
    if (raw) return JSON.parse(raw) as CalendarEvents;
  } catch {
    /* ignore */
  }
  return {};
}

function saveEvents(events: CalendarEvents) {
  try {
    localStorage.setItem("jarvis-calendar-events", JSON.stringify(events));
  } catch {
    /* ignore */
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Returns Monday-based day-of-week offset (0=Mon, 6=Sun) */
function getMondayOffset(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay(); // 0=Sun
  return day === 0 ? 6 : day - 1;
}

function getMonthName(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("ru-RU", { month: "long" });
}

function buildCells(viewYear: number, viewMonth: number) {
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const offset = getMondayOffset(viewYear, viewMonth);
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const result: {
    day: number;
    currentMonth: boolean;
    key: string;
  }[] = [];

  // Previous month padding
  for (let i = offset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    result.push({
      day: d,
      currentMonth: false,
      key: dateKey(prevYear, prevMonth, d),
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    result.push({
      day: d,
      currentMonth: true,
      key: dateKey(viewYear, viewMonth, d),
    });
  }

  // Next month padding to fill 42 cells
  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const remaining = 42 - result.length;
  for (let d = 1; d <= remaining; d++) {
    result.push({
      day: d,
      currentMonth: false,
      key: dateKey(nextYear, nextMonth, d),
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarWidget() {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvents>({});
  const [newEventText, setNewEventText] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load events from localStorage on mount
  useEffect(() => {
    setEvents(loadEvents());
    setMounted(true);
  }, []);

  const todayStr = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const cells = buildCells(viewYear, viewMonth);
  const monthLabel = getMonthName(viewYear, viewMonth);
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const selectedEvents = selectedDate ? events[selectedDate] ?? [] : [];

  // Navigation handlers
  function goToPrev() {
    playSound("click", 0.2);
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goToNext() {
    playSound("click", 0.2);
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function handleDayClick(key: string) {
    playSound("click", 0.2);
    setSelectedDate(key);
    setNewEventText("");
    // Focus the input after a tick
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleAddEvent() {
    if (!selectedDate || !newEventText.trim()) return;
    playSound("click", 0.2);
    const updated = { ...events };
    if (!updated[selectedDate]) updated[selectedDate] = [];
    updated[selectedDate].push(newEventText.trim());
    setEvents(updated);
    saveEvents(updated);
    setNewEventText("");
  }

  function handleRemoveEvent(dateStr: string, index: number) {
    playSound("click", 0.2);
    const updated = { ...events };
    updated[dateStr] = updated[dateStr].filter((_, i) => i !== index);
    if (updated[dateStr].length === 0) delete updated[dateStr];
    setEvents(updated);
    saveEvents(updated);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleAddEvent();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="jarvis-box-glow jarvis-corner-brackets jarvis-grid-bg relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-3 backdrop-blur-sm"
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />

      <div className="relative flex flex-col">
        {/* Header */}
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Calendar
            </span>
          </div>
        </div>

        {/* Month/Year navigation */}
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={goToPrev}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-primary transition"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <span className="font-mono text-[11px] uppercase tracking-wider text-foreground/90">
            {capitalizedMonth} {viewYear}
          </span>

          <button
            onClick={goToNext}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-primary transition"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="mb-1 grid grid-cols-7 gap-0.5">
          {WEEK_DAYS.map((d) => (
            <div
              key={d}
              className="flex h-5 items-center justify-center font-mono text-[11px] text-muted-foreground/50"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, i) => {
            const isToday = mounted && cell.key === todayStr;
            const isSelected = cell.key === selectedDate;
            const hasEvents = (events[cell.key]?.length ?? 0) > 0;

            return (
              <button
                key={i}
                onClick={() => handleDayClick(cell.key)}
                className={`relative flex w-7 h-7 items-center justify-center rounded text-center font-mono text-[10px] cursor-pointer hover:bg-primary/10 transition ${
                  !cell.currentMonth
                    ? "text-muted-foreground/30"
                    : isToday
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : isSelected
                        ? "bg-primary/30 text-primary"
                        : "text-foreground/70"
                }`}
              >
                {cell.day}
                {/* Today dot indicator */}
                {isToday && (
                  <span className="absolute bottom-0.5 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" />
                )}
                {/* Event indicator dot for other days */}
                {!isToday && hasEvents && cell.currentMonth && (
                  <span className="absolute bottom-0.5 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary/60" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day panel */}
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden"
          >
            <div className="border-t border-border/30 pt-2">
              {/* Selected date label */}
              <div className="mb-1.5 font-mono text-[10px] text-muted-foreground/60">
                {selectedDate}
              </div>

              {/* Events list */}
              {selectedEvents.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1">
                  {selectedEvents.map((evt, idx) => (
                    <button
                      key={`${evt}-${idx}`}
                      onClick={() => handleRemoveEvent(selectedDate, idx)}
                      className="jarvis-chip cursor-pointer font-mono text-[9px] text-primary/90 hover:text-red-400 hover:border-red-400/40 transition"
                      title="Click to remove"
                    >
                      {evt}
                    </button>
                  ))}
                </div>
              )}

              {/* Add event input */}
              <div className="flex gap-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={newEventText}
                  onChange={(e) => setNewEventText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add event…"
                  className="flex-1 rounded border border-border/50 bg-background/40 px-2 py-1 font-mono text-[10px] text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:border-primary/40 transition"
                />
                <button
                  onClick={handleAddEvent}
                  disabled={!newEventText.trim()}
                  className="rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary transition hover:bg-primary/20 disabled:opacity-30 disabled:cursor-default"
                >
                  +
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}