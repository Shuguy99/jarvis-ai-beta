// ============================================================
// JARVIS Event Bus — Typed central nervous system
// All major actions emit events; modules subscribe freely.
// ============================================================

// ── Event types ───────────────────────────────────────────

export type JARVISEvents = {
  // Chat events
  "chat:message-sent": { messageId: string; content: string; provider: string };
  "chat:response-start": { messageId: string };
  "chat:response-chunk": { messageId: string; chunk: string };
  "chat:response-complete": { messageId: string; content: string; tokensUsed?: number; duration?: number };
  "chat:response-error": { messageId: string; error: string };

  // AI Provider events
  "ai:provider-changed": { provider: string; model: string };
  "ai:request-start": { provider: string; model: string; messageId: string };
  "ai:request-complete": { provider: string; model: string; messageId: string; duration: number; tokens?: number };
  "ai:request-error": { provider: string; model: string; error: string };

  // Tool events
  "tool:called": { toolName: string; params: unknown; result: unknown };
  "tool:error": { toolName: string; error: string };

  // Agent events
  "agent:started": { messageId: string };
  "agent:iteration": { messageId: string; iteration: number; toolName?: string };
  "agent:complete": { messageId: string; iterations: number };
  "agent:error": { messageId: string; error: string };

  // Voice events
  "voice:started": { mode: "stt" | "tts" };
  "voice:stopped": { mode: "stt" | "tts" };
  "voice:transcript": { text: string; isFinal: boolean };

  // Memory events
  "memory:added": { category: string; content: string };
  "memory:deleted": { id: string };

  // UI events
  "ui:theme-changed": { theme: string };
  "ui:persona-changed": { personaId: string };
  "ui:panel-toggled": { panel: string; open: boolean };
  "ui:sidebar-toggled": { side: "left" | "right"; open: boolean };

  // System events
  "system:online": {};
  "system:offline": {};
  "system:error": { source: string; error: string; severity: "low" | "medium" | "high" | "critical" };
  "plugin:loaded": { pluginId: string; name: string };
  "plugin:unloaded": { pluginId: string };
};

export type JARVISKey = keyof JARVISEvents;

type Handler<K extends JARVISKey> = (data: JARVISEvents[K]) => void;

// ── EventBus class ────────────────────────────────────────

const MAX_LISTENERS_PER_EVENT = 100;

export class EventBus {
  private listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends JARVISKey>(event: K, handler: Handler<K>): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }

    if (set.size >= MAX_LISTENERS_PER_EVENT) {
      console.warn(
        `[EventBus] Event "${event}" has ${set.size} listeners (max ${MAX_LISTENERS_PER_EVENT}). Consider removing unused listeners.`
      );
    }

    set.add(handler as (...args: unknown[]) => void);
    return () => {
      set!.delete(handler as (...args: unknown[]) => void);
      if (set!.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Remove a specific handler for an event.
   */
  off<K extends JARVISKey>(event: K, handler: Handler<K>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler as (...args: unknown[]) => void);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit an event with data. Handler errors are caught so one
   * failing handler never breaks others.
   */
  emit<K extends JARVISKey>(event: K, data: JARVISEvents[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;

    for (const handler of set) {
      try {
        handler(data);
      } catch (err) {
        console.error(`[EventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  /**
   * Subscribe to an event, but auto-unsubscribe after the first emission.
   * Returns an unsubscribe function (in case you need to cancel before fire).
   */
  once<K extends JARVISKey>(event: K, handler: Handler<K>): () => void {
    const wrapper: Handler<K> = (data) => {
      unsubscribe();
      handler(data);
    };
    const unsubscribe = this.on(event, wrapper);
    return unsubscribe;
  }

  /**
   * Remove all listeners, optionally scoped to a single event.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Return the number of active listeners for a given event.
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * Return a list of all event names that have at least one listener.
   */
  getEventNames(): string[] {
    return [...this.listeners.keys()];
  }
}

// ── Singleton ─────────────────────────────────────────────

export const eventBus = new EventBus();