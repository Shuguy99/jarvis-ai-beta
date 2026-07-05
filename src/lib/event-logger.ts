// ============================================================
// Event Logger — Ring-buffer logger that auto-subscribes to
// the event bus on first use (lazy initialization).
// ============================================================

import { eventBus } from "@/lib/event-bus";
import type { JARVISKey, JARVISEvents } from "@/lib/event-bus";

export interface EventLogEntry {
  id: string;
  timestamp: number;
  event: string;
  data: JARVISEvents[JARVISKey];
}

const MAX_LOG_SIZE = 1000;

let ringBuffer: EventLogEntry[] = [];
let idCounter = 0;
let subscribed = false;
let listeners: Array<() => void> = [];

/** Lazy-init: subscribe to every known event the first time someone calls us. */
function ensureSubscribed(): void {
  if (subscribed) return;
  subscribed = true;

  const allEvents: JARVISKey[] = [
    "chat:message-sent",
    "chat:response-start",
    "chat:response-chunk",
    "chat:response-complete",
    "chat:response-error",
    "ai:provider-changed",
    "ai:request-start",
    "ai:request-complete",
    "ai:request-error",
    "tool:called",
    "tool:error",
    "agent:started",
    "agent:iteration",
    "agent:complete",
    "agent:error",
    "voice:started",
    "voice:stopped",
    "voice:transcript",
    "memory:added",
    "memory:deleted",
    "ui:theme-changed",
    "ui:persona-changed",
    "ui:panel-toggled",
    "ui:sidebar-toggled",
    "system:online",
    "system:offline",
    "system:error",
    "plugin:loaded",
    "plugin:unloaded",
  ];

  for (const evt of allEvents) {
    const unsub = eventBus.on(evt, (data) => {
      const entry: EventLogEntry = {
        id: String(++idCounter),
        timestamp: Date.now(),
        event: evt,
        data,
      };
      ringBuffer.push(entry);
      if (ringBuffer.length > MAX_LOG_SIZE) {
        ringBuffer = ringBuffer.slice(-MAX_LOG_SIZE);
      }
    });
    listeners.push(unsub);
  }
}

/** Stop all subscriptions (for testing / cleanup). */
export function destroyEventLogger(): void {
  for (const unsub of listeners) unsub();
  listeners = [];
  subscribed = false;
  ringBuffer = [];
  idCounter = 0;
}

// ── Public API ───────────────────────────────────────────

/** Return all log entries currently in the ring buffer. */
export function getEventLogs(): EventLogEntry[] {
  ensureSubscribed();
  return [...ringBuffer];
}

/** Return log entries for a specific event name. */
export function getEventLogsByEvent(event: string): EventLogEntry[] {
  ensureSubscribed();
  return ringBuffer.filter((e) => e.event === event);
}

/** Return log entries since a given timestamp (ms). */
export function getEventLogsSince(timestamp: number): EventLogEntry[] {
  ensureSubscribed();
  return ringBuffer.filter((e) => e.timestamp >= timestamp);
}

/** Clear all stored logs. */
export function clearEventLogs(): void {
  ringBuffer = [];
}

/** Export logs in the given format. */
export function exportEventLogs(format: "json" | "csv"): string {
  const logs = getEventLogs();

  if (format === "json") {
    return JSON.stringify(logs, null, 2);
  }

  // CSV: escape fields that might contain commas / quotes
  const escape = (v: string) => {
    if (/[,"\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };

  const header = "id,timestamp,event,data";
  const rows = logs.map(
    (l) =>
      `${l.id},${l.timestamp},${escape(l.event)},${escape(JSON.stringify(l.data))}`
  );
  return [header, ...rows].join("\n");
}