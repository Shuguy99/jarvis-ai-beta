/**
 * JARVIS Calendar Service — local CRUD + Google Calendar API sync.
 * Storage: localStorage under "jarvis-calendar-events" / "jarvis-calendar-config".
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string;        // ISO-8601 datetime string
  end: string;          // ISO-8601 datetime string
  allDay: boolean;
  location: string;
  color: string;
  source: "local" | "google";
  reminders: number[];  // minutes before event
  createdAt: string;    // ISO-8601
}

export interface CalendarConfig {
  googleEnabled: boolean;
  googleClientId: string;
  googleApiKey: string;
  googleCalendarId: string;
  defaultReminderMinutes: number;
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_EVENTS = "jarvis-calendar-events";
const STORAGE_CONFIG = "jarvis-calendar-config";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function loadEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_EVENTS);
    if (raw) return JSON.parse(raw) as CalendarEvent[];
  } catch {
    /* ignore */
  }
  return [];
}

function saveEvents(events: CalendarEvent[]) {
  try {
    localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));
  } catch {
    /* ignore */
  }
}

function loadConfig(): CalendarConfig {
  const defaults: CalendarConfig = {
    googleEnabled: false,
    googleClientId: "",
    googleApiKey: "",
    googleCalendarId: "primary",
    defaultReminderMinutes: 15,
  };
  try {
    const raw = localStorage.getItem(STORAGE_CONFIG);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults;
}

function saveConfig(config: CalendarConfig) {
  try {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Local CRUD
// ---------------------------------------------------------------------------

export function getEvents(): CalendarEvent[] {
  return loadEvents();
}

export function addEvent(data: {
  title: string;
  start: string;
  end?: string;
  description?: string;
  allDay?: boolean;
  location?: string;
  color?: string;
  reminders?: number[];
}): CalendarEvent {
  const events = loadEvents();
  const now = new Date().toISOString();
  const ev: CalendarEvent = {
    id: uid(),
    title: data.title.trim(),
    description: data.description?.trim() ?? "",
    start: data.start,
    end: data.end ?? data.start,
    allDay: data.allDay ?? false,
    location: data.location?.trim() ?? "",
    color: data.color ?? "cyan",
    source: "local",
    reminders: data.reminders ?? [loadConfig().defaultReminderMinutes],
    createdAt: now,
  };
  events.push(ev);
  saveEvents(events);
  return ev;
}

export function updateEvent(
  id: string,
  data: Partial<Omit<CalendarEvent, "id" | "source" | "createdAt">>
): CalendarEvent | null {
  const events = loadEvents();
  const idx = events.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  events[idx] = { ...events[idx], ...data };
  saveEvents(events);
  return events[idx];
}

export function deleteEvent(id: string): boolean {
  const events = loadEvents();
  const filtered = events.filter((e) => e.id !== id);
  if (filtered.length === events.length) return false;
  saveEvents(filtered);
  return true;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

function toDateKey(iso: string): string {
  // "2025-01-15T10:30:00.000Z" → "2025-01-15"
  return iso.slice(0, 10);
}

export function getEventsForDate(date: string): CalendarEvent[] {
  // date is "YYYY-MM-DD"
  return loadEvents().filter((e) => toDateKey(e.start) === date);
}

export function getUpcomingEvents(limit = 10): CalendarEvent[] {
  const now = new Date();
  return loadEvents()
    .filter((e) => new Date(e.start) >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, limit);
}

export function getEventsForRange(start: string, end: string): CalendarEvent[] {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return loadEvents().filter((ev) => {
    const evStart = new Date(ev.start).getTime();
    return evStart >= s && evStart <= e;
  });
}

// ---------------------------------------------------------------------------
// Google Calendar
// ---------------------------------------------------------------------------

export function getCalendarConfig(): CalendarConfig {
  return loadConfig();
}

export function saveCalendarConfig(config: Partial<CalendarConfig>): CalendarConfig {
  const current = loadConfig();
  const updated = { ...current, ...config };
  saveConfig(updated);
  return updated;
}

export async function fetchGoogleEvents(
  calendarId?: string,
  apiKey?: string,
  timeMin?: string,
  timeMax?: string,
  maxResults = 50
): Promise<CalendarEvent[]> {
  const config = loadConfig();
  const key = apiKey || config.googleApiKey;
  const calId = calendarId || config.googleCalendarId || "primary";

  if (!key) {
    throw new Error("Google API key is required for sync");
  }

  const params = new URLSearchParams({
    key,
    maxResults: String(maxResults),
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: timeMin || new Date().toISOString(),
  });

  if (timeMax) params.set("timeMax", timeMax);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Calendar API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const items: CalendarEvent[] = [];

  for (const item of data.items ?? []) {
    const start = item.start?.dateTime ?? item.start?.date ?? "";
    const end = item.end?.dateTime ?? item.end?.date ?? start;
    const allDay = !item.start?.dateTime;

    items.push({
      id: item.id || uid(),
      title: item.summary || "(No title)",
      description: item.description || "",
      start,
      end,
      allDay,
      location: item.location || "",
      color: item.colorId ? gcalColorToHex(item.colorId) : "cyan",
      source: "google",
      reminders: item.reminders?.overrides?.map((r: { minutes: number }) => r.minutes) ?? [],
      createdAt: item.created || new Date().toISOString(),
    });
  }

  // Merge with existing local events, replacing old google events for same calendar
  const local = loadEvents().filter((e) => e.source !== "google");
  const merged = [...local, ...items];
  saveEvents(merged);

  return items;
}

export async function createGoogleEvent(
  event: { title: string; start: string; end: string; description?: string; location?: string; allDay?: boolean },
  accessToken?: string
): Promise<CalendarEvent | null> {
  // Google Calendar create requires OAuth, not just API key.
  // This is a placeholder for future OAuth integration.
  void accessToken;
  console.warn("createGoogleEvent: OAuth not yet implemented. Event saved locally only.");
  const ev = addEvent({ ...event, source: "local" } as never);
  return ev;
}

function gcalColorToHex(colorId: string): string {
  const map: Record<string, string> = {
    "1": "cyan",
    "2": "emerald",
    "3": "amber",
    "4": "rose",
    "5": "violet",
    "6": "orange",
    "7": "blue",
    "8": "fuchsia",
    "9": "lime",
    "10": "teal",
    "11": "sky",
  };
  return map[colorId] || "cyan";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatEventTime(start: string, end: string, allDay?: boolean): string {
  if (allDay) {
    return "All day";
  }
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function isEventNow(event: CalendarEvent): boolean {
  const now = new Date();
  const start = new Date(event.start);
  const end = new Date(event.end);
  return now >= start && now <= end;
}

export function isEventUpcoming(event: CalendarEvent): boolean {
  const now = new Date();
  const start = new Date(event.start);
  // Upcoming: starts within the next 60 minutes
  const diff = start.getTime() - now.getTime();
  return diff > 0 && diff <= 60 * 60 * 1000;
}