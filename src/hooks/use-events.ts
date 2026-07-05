// ============================================================
// use-events — React hooks for the JARVIS event bus
// ============================================================

import { useEffect, useRef, useSyncExternalStore } from "react";
import { eventBus } from "@/lib/event-bus";
import type { JARVISKey, JARVISEvents } from "@/lib/event-bus";
import {
  getEventLogs,
  clearEventLogs,
  type EventLogEntry,
} from "@/lib/event-logger";

// ── Incrementing counter to force re-renders on new logs ──

let logVersion = 0;
const logListeners = new Set<() => void>();

function subscribeToLogVersion(onChange: () => void): () => void {
  logListeners.add(onChange);
  return () => { logListeners.delete(onChange); };
}

function bumpLogVersion(): void {
  logVersion++;
  for (const fn of logListeners) fn();
}

function getLogVersionSnapshot(): number {
  return logVersion;
}

// ── useEventBus ───────────────────────────────────────────

/**
 * Subscribe to a typed event on the event bus.
 * Auto-cleans up on unmount. Uses a ref for the handler
 * so the callback always sees fresh closure values without
 * re-subscribing.
 */
export function useEventBus<K extends JARVISKey>(
  event: K,
  handler: (data: JARVISEvents[K]) => void
): void {
  // Keep the handler in a ref so we don't need to re-subscribe
  // when the callback identity changes.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stableHandler = (data: JARVISEvents[K]) => handlerRef.current(data);
    const unsub = eventBus.on(event, stableHandler);
    return unsub;
  }, [event]);
}

// ── useEventLogs ──────────────────────────────────────────

/**
 * Provides reactive access to the event log ring buffer.
 * Returns the current entries plus a `clear` helper.
 * Re-renders whenever a new event is logged.
 */
export function useEventLogs(): {
  logs: EventLogEntry[];
  clear: () => void;
} {
  // We need a small effect to subscribe to the event bus just-in-time
  // (lazy) so the logger is only active when a component is mounted.
  useEffect(() => {
    // Trigger lazy init
    const logs = getEventLogs();
    if (logs.length === 0) {
      // First access — subscribe to a dummy event to ensure logger is alive
      const unsub = eventBus.on("system:online", () => {
        bumpLogVersion();
      });
      return unsub;
    }
  }, []);

  // Listen for *all* events to bump the version when anything arrives
  useEffect(() => {
    const unsubs: Array<() => void> = [];
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
      unsubs.push(
        eventBus.on(evt, () => {
          bumpLogVersion();
        })
      );
    }
    return () => { for (const u of unsubs) u(); };
  }, []);

  // useSyncExternalStore for snapshotted reads
  const version = useSyncExternalStore(
    subscribeToLogVersion,
    getLogVersionSnapshot,
    getLogVersionSnapshot
  );

  // Re-derive logs when version changes (version is used as a
  // dependency key for the consumer's useMemo if needed, but
  // useSyncExternalStore already forces re-render).
  // The `version` read ensures React knows this value changes.
  void version;

  return {
    logs: getEventLogs(),
    clear: () => {
      clearEventLogs();
      bumpLogVersion();
    },
  };
}