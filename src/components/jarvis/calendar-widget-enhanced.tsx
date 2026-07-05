"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, Clock, MapPin, Trash2,
  RefreshCw, Calendar as CalIcon, ExternalLink,
} from "lucide-react";
import {
  getEvents, getEventsForDate, getUpcomingEvents, addEvent, deleteEvent,
  getCalendarConfig, saveCalendarConfig, fetchGoogleEvents,
  formatEventTime, isEventNow, isEventUpcoming,
  type CalendarEvent, type CalendarConfig,
} from "@/lib/calendar-service";
import { playSound } from "@/lib/sounds";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const COLOR_OPTIONS = [
  { name: "cyan", dot: "bg-cyan-400" },
  { name: "emerald", dot: "bg-emerald-400" },
  { name: "amber", dot: "bg-amber-400" },
  { name: "rose", dot: "bg-rose-400" },
  { name: "violet", dot: "bg-violet-400" },
  { name: "orange", dot: "bg-orange-400" },
] as const;

const COLOR_DOT_MAP: Record<string, string> = {
  cyan: "bg-cyan-400",
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  rose: "bg-rose-400",
  violet: "bg-violet-400",
  orange: "bg-orange-400",
  blue: "bg-blue-400",
  fuchsia: "bg-fuchsia-400",
  lime: "bg-lime-400",
  teal: "bg-teal-400",
  sky: "bg-sky-400",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function todayKey(): string {
  const d = new Date();
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMondayOffset(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function getMonthName(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("ru-RU", { month: "long" });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ru-RU", { weekday: "short", day: "numeric", month: "short" });
}

interface Cell {
  day: number;
  currentMonth: boolean;
  key: string;
}

function buildCells(viewYear: number, viewMonth: number): Cell[] {
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const offset = getMondayOffset(viewYear, viewMonth);
  const prevMonth = viewMonth === 0 ? 11 : viewMonth - 1;
  const prevYear = viewMonth === 0 ? viewYear - 1 : viewYear;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  const result: Cell[] = [];

  for (let i = offset - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    result.push({ day: d, currentMonth: false, key: dateKey(prevYear, prevMonth, d) });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    result.push({ day: d, currentMonth: true, key: dateKey(viewYear, viewMonth, d) });
  }

  const nextMonth = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextYear = viewMonth === 11 ? viewYear + 1 : viewYear;
  const remaining = 42 - result.length;
  for (let d = 1; d <= remaining; d++) {
    result.push({ day: d, currentMonth: false, key: dateKey(nextYear, nextMonth, d) });
  }

  return result;
}

function hasEventsOnDate(events: CalendarEvent[], key: string): boolean {
  return events.some((e) => e.start.slice(0, 10) === key);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CalendarWidgetEnhanced() {
  const now = new Date();
  const today = todayKey();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [events, setEvents] = useState<CalendarEvent[]>(() => getEvents());
  const [upcoming, setUpcoming] = useState<CalendarEvent[]>(() => getUpcomingEvents(3));
  const [config, setConfig] = useState<CalendarConfig>(() => getCalendarConfig());
  const [showAddForm, setShowAddForm] = useState(false);
  const [showGoogleConfig, setShowGoogleConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Add event form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStartTime, setNewStartTime] = useState("10:00");
  const [newEndTime, setNewEndTime] = useState("11:00");
  const [newColor, setNewColor] = useState("cyan");

  // Google config state
  const [gCalId, setGCalId] = useState(config.googleCalendarId);
  const [gApiKey, setGApiKey] = useState(config.googleApiKey);

  const mounted = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refreshEvents = useCallback(() => {
    setEvents(getEvents());
    setUpcoming(getUpcomingEvents(3));
  }, []);

  // ---- Navigation ----

  function goToPrev() {
    playSound("click", 0.2);
    setViewMonth((m) => {
      if (m === 0) { setViewYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }

  function goToNext() {
    playSound("click", 0.2);
    setViewMonth((m) => {
      if (m === 11) { setViewYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }

  function goToToday() {
    playSound("click", 0.2);
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(today);
  }

  // ---- Day selection ----

  function handleDayClick(key: string) {
    playSound("click", 0.2);
    setSelectedDate(key);
    setShowAddForm(false);
  }

  // ---- CRUD ----

  function handleAddEvent() {
    if (!newTitle.trim() || !selectedDate) return;
    playSound("success", 0.3);
    const startISO = `${selectedDate}T${newStartTime}:00`;
    const endISO = `${selectedDate}T${newEndTime}:00`;
    addEvent({ title: newTitle, start: startISO, end: endISO, description: newDesc, color: newColor });
    refreshEvents();
    setNewTitle("");
    setNewDesc("");
    setNewStartTime("10:00");
    setNewEndTime("11:00");
    setNewColor("cyan");
    setShowAddForm(false);
  }

  function handleDeleteEvent(id: string) {
    playSound("click", 0.2);
    deleteEvent(id);
    refreshEvents();
  }

  // ---- Google Calendar sync ----

  async function handleSync() {
    playSound("click", 0.2);
    setSyncing(true);
    try {
      await fetchGoogleEvents(gCalId, gApiKey);
      refreshEvents();
      playSound("success", 0.3);
    } catch (err) {
      console.error("Calendar sync failed:", err);
      playSound("error", 0.3);
    } finally {
      setSyncing(false);
    }
  }

  function handleSaveGoogleConfig() {
    playSound("save", 0.3);
    const updated = saveCalendarConfig({
      googleEnabled: true,
      googleCalendarId: gCalId,
      googleApiKey: gApiKey,
    });
    setConfig(updated);
    setShowGoogleConfig(false);
  }

  // ---- Derived state ----

  const cells = buildCells(viewYear, viewMonth);
  const monthLabel = getMonthName(viewYear, viewMonth);
  const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);
  const selectedDayEvents = getEventsForDate(selectedDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="jarvis-box-glow jarvis-corner-brackets jarvis-grid-bg relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-3 backdrop-blur-sm"
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />

      <div className="relative flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalIcon className="h-3.5 w-3.5 text-primary anim-pulse-glow" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Calendar
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { playSound("click", 0.2); setShowGoogleConfig((v) => !v); }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-primary transition"
              title="Google Calendar settings"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-primary transition"
              title="Sync Google Calendar"
            >
              <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => { playSound("click", 0.2); setShowAddForm((v) => !v); }}
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:text-primary transition"
              title="Add event"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Month/Year navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={goToPrev}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-primary transition"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-foreground/90">
              {capitalizedMonth} {viewYear}
            </span>
            <button
              onClick={goToToday}
              className="font-mono text-[9px] rounded border border-primary/30 px-1.5 py-0.5 text-primary/70 hover:text-primary hover:border-primary/60 transition"
            >
              Today
            </button>
          </div>

          <button
            onClick={goToNext}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground/60 hover:text-primary transition"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 gap-0.5">
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
            const isToday = mounted.current && cell.key === today;
            const isSelected = cell.key === selectedDate;
            const hasEvts = hasEventsOnDate(events, cell.key);

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
                {isToday && (
                  <span className="absolute bottom-0.5 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary" />
                )}
                {!isToday && hasEvts && cell.currentMonth && (
                  <span className="absolute bottom-0.5 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-primary/60" />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day events */}
        <div className="border-t border-border/30 pt-2">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {formatDayLabel(selectedDate)}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/40">
              {selectedDayEvents.length} event{selectedDayEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="jarvis-scroll max-h-[120px] overflow-y-auto flex flex-col gap-1">
            <AnimatePresence mode="popLayout">
              {selectedDayEvents.length === 0 && (
                <motion.p
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[10px] text-muted-foreground/30 italic py-1"
                >
                  No events
                </motion.p>
              )}
              {selectedDayEvents.map((evt) => {
                const nowActive = isEventNow(evt);
                const upcomingSoon = isEventUpcoming(evt);
                const dotColor = COLOR_DOT_MAP[evt.color] || "bg-cyan-400";

                return (
                  <motion.div
                    key={evt.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`group relative flex items-start gap-2 rounded border px-2 py-1.5 transition ${
                      nowActive
                        ? "border-primary/50 bg-primary/10"
                        : upcomingSoon
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-border/30 bg-card/20"
                    }`}
                  >
                    {/* Color dot */}
                    <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${dotColor}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={`font-mono text-[10px] truncate ${nowActive ? "text-primary" : "text-foreground/80"}`}>
                          {evt.title}
                        </span>
                        {evt.source === "google" && (
                          <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[9px] text-muted-foreground/50">
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {formatEventTime(evt.start, evt.end, evt.allDay)}
                        </span>
                        {evt.location && (
                          <span className="flex items-center gap-0.5 truncate">
                            <MapPin className="h-2.5 w-2.5" />
                            {evt.location}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button on hover */}
                    {evt.source === "local" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteEvent(evt.id); }}
                        className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded text-muted-foreground/0 group-hover:text-red-400/80 hover:!text-red-400 transition"
                        aria-label="Delete event"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Upcoming events section */}
        {upcoming.length > 0 && (
          <div className="border-t border-border/30 pt-2">
            <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
              Upcoming
            </div>
            <div className="flex flex-col gap-1">
              {upcoming.map((evt) => {
                const dotColor = COLOR_DOT_MAP[evt.color] || "bg-cyan-400";
                return (
                  <div key={evt.id} className="flex items-center gap-2 px-1">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`} />
                    <span className="flex-1 font-mono text-[10px] text-foreground/70 truncate">
                      {evt.title}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground/40">
                      {evt.start.slice(11, 16)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick add event form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/30 pt-2 flex flex-col gap-1.5">
                <div className="flex gap-1">
                  <input
                    ref={titleInputRef}
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Title"
                    className="flex-1 rounded border border-border/50 bg-background/40 px-2 py-1 font-mono text-[10px] text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:border-primary/40 transition"
                    autoFocus
                  />
                  <input
                    type="text"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Description"
                    className="flex-1 rounded border border-border/50 bg-background/40 px-2 py-1 font-mono text-[10px] text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:border-primary/40 transition"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    className="rounded border border-border/50 bg-background/40 px-1.5 py-1 font-mono text-[10px] text-foreground/80 outline-none focus:border-primary/40 transition"
                  />
                  <span className="font-mono text-[10px] text-muted-foreground/30">–</span>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="rounded border border-border/50 bg-background/40 px-1.5 py-1 font-mono text-[10px] text-foreground/80 outline-none focus:border-primary/40 transition"
                  />
                </div>
                {/* Color picker */}
                <div className="flex items-center gap-1.5">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setNewColor(c.name)}
                      className={`h-3.5 w-3.5 rounded-full ${c.dot} transition ${
                        newColor === c.name ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "opacity-60 hover:opacity-100"
                      }`}
                      aria-label={c.name}
                    />
                  ))}
                </div>
                {/* Submit */}
                <button
                  onClick={handleAddEvent}
                  disabled={!newTitle.trim()}
                  className="mt-0.5 flex items-center justify-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary transition hover:bg-primary/20 disabled:opacity-30 disabled:cursor-default"
                >
                  <Plus className="h-3 w-3" />
                  Add Event
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Google Calendar config panel */}
        <AnimatePresence>
          {showGoogleConfig && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/30 pt-2 flex flex-col gap-1.5">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  Google Calendar
                </div>
                <input
                  type="text"
                  value={gCalId}
                  onChange={(e) => setGCalId(e.target.value)}
                  placeholder="Calendar ID (primary)"
                  className="rounded border border-border/50 bg-background/40 px-2 py-1 font-mono text-[10px] text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:border-primary/40 transition"
                />
                <input
                  type="password"
                  value={gApiKey}
                  onChange={(e) => setGApiKey(e.target.value)}
                  placeholder="Google API Key"
                  className="rounded border border-border/50 bg-background/40 px-2 py-1 font-mono text-[10px] text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:border-primary/40 transition"
                />
                <button
                  onClick={handleSaveGoogleConfig}
                  className="flex items-center justify-center gap-1 rounded border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary transition hover:bg-primary/20"
                >
                  Save Config
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}