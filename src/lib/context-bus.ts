// ============================================================
// JARVIS Context Bus — Unified type-safe event system
// Enables cross-module communication and event correlation
// across all JARVIS widgets (weather, system, chat, etc.)
// ============================================================

// -----------------------------------------------------------
// 1. Event Types — discriminated union covering all JARVIS modules
// -----------------------------------------------------------

type BaseEvent<T extends string, D = Record<string, unknown>> = {
  type: T;
  data: D;
  timestamp: number;
};

export type ContextEvent =
  | BaseEvent<"weather:updated", {
      temp: number;
      condition: string;
      humidity: number;
      windSpeed: number;
      location: string;
    }>
  | BaseEvent<"system:cpu-high", {
      cpuLoad: number;
      topProcess: string;
      topProcessCpu: number;
    }>
  | BaseEvent<"system:ram-high", {
      memPct: number;
      availableGB: number;
    }>
  | BaseEvent<"system:disk-warning", {
      diskPct: number;
      usedGB: number;
      totalGB: number;
    }>
  | BaseEvent<"system:temp-high", {
      temp: number;
      maxTemp: number;
    }>
  | BaseEvent<"system:metrics", {
      cpuLoad: number;
      memPct: number;
      diskPct: number;
      temp: number;
      netSpeedIn: number;
      netSpeedOut: number;
    }>
  | BaseEvent<"process:killed", {
      pid: number;
      name: string;
    }>
  | BaseEvent<"process:high-cpu", {
      pid: number;
      name: string;
      cpu: number;
    }>
  | BaseEvent<"network:traffic-spike", {
      speedMbps: number;
      direction: "in" | "out";
    }>
  | BaseEvent<"network:disconnected", Record<string, never>>
  | BaseEvent<"chat:message-sent", {
      messageId: string;
      content: string;
    }>
  | BaseEvent<"chat:message-received", {
      messageId: string;
      content: string;
      charCount: number;
    }>
  | BaseEvent<"chat:web-search", {
      query: string;
      resultsCount: number;
    }>
  | BaseEvent<"chat:voice-activated", Record<string, never>>
  | BaseEvent<"chat:image-analyzed", {
      description: string;
    }>
  | BaseEvent<"chat:screen-captured", {
      prompt: string;
    }>
  | BaseEvent<"calendar:event-reminder", {
      eventTitle: string;
      eventTime: string;
      minutesUntil: number;
    }>
  | BaseEvent<"calendar:event-added", {
      title: string;
      date: string;
    }>
  | BaseEvent<"notes:created", {
      noteId: string;
      title: string;
    }>
  | BaseEvent<"weather:alert", {
      alert: string;
      severity: "warning" | "critical";
    }>
  | BaseEvent<"agent:task-started", {
      task: string;
    }>
  | BaseEvent<"agent:task-completed", {
      task: string;
      success: boolean;
    }>
  | BaseEvent<"jarvis:proactive-alert", {
      message: string;
      severity: "info" | "warning" | "error";
    }>
  // Generic fallback for future extensibility
  | BaseEvent<string>;

// -----------------------------------------------------------
// 2. Listener type
// -----------------------------------------------------------

type EventListener<T extends ContextEvent = ContextEvent> = (event: T) => void;

// -----------------------------------------------------------
// 3. ContextBus class — module-level singleton
// -----------------------------------------------------------

const MAX_HISTORY_DEFAULT = 100;

class ContextBus {
  private listeners: Map<string, Set<EventListener>>;
  private history: ContextEvent[];
  private maxHistory: number;

  constructor(maxHistory: number = MAX_HISTORY_DEFAULT) {
    this.listeners = new Map();
    this.history = [];
    this.maxHistory = maxHistory;
  }

  /**
   * Publish an event.
   * Notifies all listeners subscribed to the specific event type
   * plus all wildcard ("*") listeners.
   * Listener errors are swallowed to prevent one bad listener from
   * disrupting the rest of the system.
   */
  publish<T extends ContextEvent>(event: T): void {
    // Attach timestamp if not already present
    if (!event.timestamp) {
      (event as ContextEvent & { timestamp: number }).timestamp = Date.now();
    }

    // Store in circular-buffer history
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Notify type-specific listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          (listener as EventListener<T>)(event);
        } catch (err) {
          console.error(
            `[ContextBus] Error in listener for "${event.type}":`,
            err
          );
        }
      }
    }

    // Notify wildcard listeners
    const wildcardListeners = this.listeners.get("*");
    if (wildcardListeners) {
      for (const listener of wildcardListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error(
            `[ContextBus] Error in wildcard listener:`,
            err
          );
        }
      }
    }
  }

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   */
  on<T extends ContextEvent>(
    eventType: T["type"],
    listener: EventListener<T>
  ): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const set = this.listeners.get(eventType)!;

    // Cast needed because the generic T narrows the listener signature,
    // but the Map stores the base EventListener type.
    const entry = listener as EventListener;
    set.add(entry);

    return () => {
      set.delete(entry);
      if (set.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Subscribe to ALL events (wildcard).
   * Returns an unsubscribe function.
   */
  onAny(listener: EventListener): () => void {
    return this.on("*" as any, listener);
  }

  /**
   * Subscribe to an event type, but only fire the listener once.
   * Returns an unsubscribe function (in case you want to cancel early).
   */
  once<T extends ContextEvent>(
    eventType: T["type"],
    listener: EventListener<T>
  ): () => void {
    const wrappedListener: EventListener<T> = (event) => {
      unsubscribe();
      listener(event);
    };

    const unsubscribe = this.on<T>(eventType, wrappedListener);
    return unsubscribe;
  }

  /**
   * Get event history, optionally filtered by type prefix and limited.
   * Returns a shallow copy — safe to mutate externally.
   */
  getHistory(typeFilter?: string, limit?: number): ContextEvent[] {
    let events = this.history;

    if (typeFilter) {
      events = events.filter((e) => e.type === typeFilter || e.type.startsWith(typeFilter));
    }

    if (limit !== undefined && limit < events.length) {
      events = events.slice(events.length - limit);
    }

    return [...events];
  }

  /**
   * Get the most recent N events for correlation purposes.
   * Defaults to the last 50 events.
   */
  getRecentEvents(count: number = 50): ContextEvent[] {
    if (count >= this.history.length) {
      return [...this.history];
    }
    return this.history.slice(this.history.length - count);
  }

  /**
   * Clear all listeners and history.
   */
  clear(): void {
    this.listeners.clear();
    this.history = [];
  }

  /**
   * Get listener count — useful for debugging.
   * Pass an eventType to get count for that type,
   * or omit for the total count across all types.
   */
  getListenerCount(eventType?: string): number {
    if (eventType) {
      return this.listeners.get(eventType)?.size ?? 0;
    }
    let total = 0;
    for (const set of this.listeners.values()) {
      total += set.size;
    }
    return total;
  }
}

// -----------------------------------------------------------
// 4. Module-level singleton export
// -----------------------------------------------------------

export const contextBus = new ContextBus();

// -----------------------------------------------------------
// 5. React hook for subscribing (client-side only)
// -----------------------------------------------------------

// Dynamic import guard — this must be at module level so bundlers
// can tree-shake it out of server bundles.
const _useEffect: typeof import("react").useEffect | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react").useEffect;
  } catch {
    return null;
  }
})();

/**
 * React hook that subscribes to a ContextBus event type and
 * automatically cleans up on unmount or dependency change.
 *
 * @param eventType  The event type string to listen for
 * @param handler    The callback to invoke when the event fires
 * @param deps       Optional dependency array (like useEffect).
 *                   If omitted, defaults to [eventType, handler].
 */
export function useContextBus<T extends ContextEvent>(
  eventType: T["type"],
  handler: EventListener<T>,
  deps?: unknown[]
): void {
  if (!_useEffect) {
    throw new Error(
      "useContextBus must be used in a React client component. " +
        'Add "use client" to the top of the file.'
    );
  }

  const useEffect = _useEffect;

  useEffect(() => {
    const unsubscribe = contextBus.on<T>(eventType, handler);
    return unsubscribe;
  }, deps ?? [eventType, handler]);
}

// -----------------------------------------------------------
// 6. Correlation helper
// -----------------------------------------------------------

/**
 * Keyword-based event correlation.
 * Scans the text representation of event data for matching keywords
 * and returns the most relevant events (most recent first).
 *
 * @param query   A free-text query describing what to look for
 * @param events  Optional event set to search (defaults to full history)
 * @returns       Events whose data contains at least one query keyword
 */
export function correlateEvents(
  query: string,
  events?: ContextEvent[]
): ContextEvent[] {
  const pool = events ?? contextBus.getRecentEvents();

  if (!query.trim()) return [...pool];

  // Normalise and split the query into individual tokens
  const keywords = query
    .toLowerCase()
    .split(/[\s,;.!?]+/)
    .filter((t) => t.length >= 2); // ignore 1-char tokens

  if (keywords.length === 0) return [...pool];

  const scored: { event: ContextEvent; score: number }[] = [];

  for (const event of pool) {
    // Serialise the event data to a string for matching
    const serialised = JSON.stringify(event.data).toLowerCase();
    const typeStr = event.type.toLowerCase();
    const combined = `${typeStr} ${serialised}`;

    let matchCount = 0;
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      scored.push({ event, score: matchCount });
    }
  }

  // Sort by relevance (more keyword hits = higher relevance),
  // then by recency (later timestamp = more recent)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.event.timestamp - a.event.timestamp;
  });

  return scored.map((s) => s.event);
}

// -----------------------------------------------------------
// 7. Convenience publish helpers
// -----------------------------------------------------------

/**
 * Publish a system:metrics event with the current readings.
 */
export function publishSystemMetrics(data: {
  cpuLoad: number;
  memPct: number;
  diskPct: number;
  temp: number;
  netSpeedIn: number;
  netSpeedOut: number;
}): void {
  contextBus.publish({
    type: "system:metrics",
    data,
    timestamp: Date.now(),
  });
}

/**
 * Publish a chat:message-sent or chat:message-received depending on direction.
 */
export function publishChatMessage(data: {
  messageId: string;
  content: string;
  isUser: boolean;
  charCount?: number;
}): void {
  if (data.isUser) {
    contextBus.publish({
      type: "chat:message-sent",
      data: { messageId: data.messageId, content: data.content },
      timestamp: Date.now(),
    });
  } else {
    contextBus.publish({
      type: "chat:message-received",
      data: {
        messageId: data.messageId,
        content: data.content,
        charCount: data.charCount ?? data.content.length,
      },
      timestamp: Date.now(),
    });
  }
}

/**
 * Publish a weather:updated event.
 */
export function publishWeatherUpdate(data: {
  temp: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  location: string;
}): void {
  contextBus.publish({
    type: "weather:updated",
    data,
    timestamp: Date.now(),
  });
}

/**
 * Publish a jarvis:proactive-alert event.
 */
export function publishProactiveAlert(data: {
  message: string;
  severity: "info" | "warning" | "error";
}): void {
  contextBus.publish({
    type: "jarvis:proactive-alert",
    data,
    timestamp: Date.now(),
  });
}