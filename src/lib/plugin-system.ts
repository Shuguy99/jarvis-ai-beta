/**
 * JARVIS Plugin System — Core Engine
 *
 * Manages plugin lifecycle: load, unload, enable/disable, execute tools,
 * persist settings, import/export. Plugin code execution is conceptually
 * sandboxed. Real sandboxing (Web Workers / iframe isolation) is a future
 * enhancement — see TODO comments below.
 */

import type {
  PluginManifest,
  PluginToolDef,
  PluginPanelDef,
  PluginSettingDef,
  PluginState,
} from "@/lib/types";

// ── Event system (simple callback bag) ──────────────────────────

type PluginEventType =
  | "load"
  | "unload"
  | "enable"
  | "disable"
  | "settings-change"
  | "tool-execute";

type PluginEventListener = (pluginId: string) => void;

// ── Built-in plugin tool handlers ───────────────────────────────
// These are the actual async function bodies for built-in plugin tools.
// TODO: For user-supplied plugins, execute inside a Web Worker for true sandboxing.

const builtinHandlers: Record<string, Record<string, (params: unknown) => Promise<unknown>>> = {
  "weather-helper": {
    get_forecast: async (params: unknown) => {
      const p = params as { location?: string; days?: number };
      const location = p.location ?? "New York";
      const days = p.days ?? 3;
      // Simulated forecast data
      const conditions = ["Sunny", "Cloudy", "Rainy", "Partly Cloudy", "Clear"];
      const forecast = Array.from({ length: days }, (_, i) => ({
        day: new Date(Date.now() + i * 86400000).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
        condition: conditions[Math.floor(Math.random() * conditions.length)],
        tempHigh: Math.round(60 + Math.random() * 30),
        tempLow: Math.round(40 + Math.random() * 20),
      }));
      return { location, forecast };
    },
  },
  "code-runner": {
    run_code: async (params: unknown) => {
      const p = params as { language?: string; code?: string };
      const language = p.language ?? "javascript";
      const code = p.code ?? "";
      // TODO: In a real implementation, this would send code to a sandboxed execution environment
      return {
        language,
        output: `[Sandbox] Executing ${language}:\n${code}\n\nOutput: (sandbox execution not yet implemented)`,
      };
    },
  },
  "timer-tool": {
    start_timer: async (params: unknown) => {
      const p = params as { minutes?: number; label?: string };
      const minutes = p.minutes ?? 5;
      const label = p.label ?? "Timer";
      return { started: true, label, minutes, message: `Timer "${label}" set for ${minutes} minute(s).` };
    },
    get_timers: async () => {
      return { timers: [], message: "No active timers." };
    },
  },
  calculator: {
    calculate: async (params: unknown) => {
      const p = params as { expression?: string };
      const expression = p.expression ?? "";
      // Safe evaluation: only allow numbers and basic operators
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, "");
      try {
        // Using Function constructor for eval in a controlled way
        // TODO: Move to Web Worker for true sandboxing
        const fn = new Function(`"use strict"; return (${sanitized})`);
        const result = fn();
        return { expression, result: typeof result === "number" ? result : String(result) };
      } catch {
        return { expression, error: "Invalid expression" };
      }
    },
  },
};

// ── Storage helpers ─────────────────────────────────────────────

const STORAGE_KEY = "jarvis-plugin-system";

interface SerializedPlugin {
  manifest: PluginManifest;
  enabled: boolean;
  settings: Record<string, unknown>;
}

function loadFromStorage(): SerializedPlugin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SerializedPlugin[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(plugins: SerializedPlugin[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
  } catch {
    /* storage full — ignore */
  }
}

// ── Built-in plugin manifests ───────────────────────────────────

export const BUILTIN_PLUGINS: PluginManifest[] = [
  {
    id: "weather-helper",
    name: "Weather Helper",
    version: "1.0.0",
    description: "Get weather forecasts for any location. Provides multi-day forecasts with temperature highs and lows.",
    author: "Stark Industries",
    icon: "CloudSun",
    tools: [
      {
        name: "get_forecast",
        description: "Get a weather forecast for a given location",
        handler: "get_forecast",
        parameters: {
          type: "object",
          properties: {
            location: { type: "string", description: "City name or location" },
            days: { type: "number", description: "Number of days (1-7)", minimum: 1, maximum: 7 },
          },
          required: ["location"],
        },
      },
    ],
    panels: [
      {
        id: "weather-panel",
        title: "Weather",
        icon: "CloudSun",
        component: "WeatherPanel",
        position: "right",
      },
    ],
    settings: [
      {
        key: "defaultLocation",
        label: "Default Location",
        type: "text",
        default: "New York",
      },
      {
        key: "units",
        label: "Temperature Units",
        type: "select",
        default: "fahrenheit",
        options: ["fahrenheit", "celsius"],
      },
      {
        key: "autoRefresh",
        label: "Auto Refresh",
        type: "boolean",
        default: false,
      },
    ],
    permissions: ["network"],
  },
  {
    id: "code-runner",
    name: "Code Runner",
    version: "1.0.0",
    description: "Execute code snippets in a sandboxed environment. Supports JavaScript, Python, and more.",
    author: "Stark Industries",
    icon: "Terminal",
    tools: [
      {
        name: "run_code",
        description: "Execute a code snippet in a sandboxed runtime",
        handler: "run_code",
        parameters: {
          type: "object",
          properties: {
            language: {
              type: "string",
              description: "Programming language",
              enum: ["javascript", "python", "typescript"],
            },
            code: { type: "string", description: "The code to execute" },
          },
          required: ["code"],
        },
      },
    ],
    settings: [
      {
        key: "timeout",
        label: "Execution Timeout (ms)",
        type: "number",
        default: 5000,
      },
      {
        key: "defaultLanguage",
        label: "Default Language",
        type: "select",
        default: "javascript",
        options: ["javascript", "python", "typescript"],
      },
    ],
    permissions: ["sandbox"],
  },
  {
    id: "timer-tool",
    name: "Timer",
    version: "1.0.0",
    description: "Set and manage countdown timers. Get notified when time is up.",
    author: "Stark Industries",
    icon: "Clock",
    tools: [
      {
        name: "start_timer",
        description: "Start a countdown timer",
        handler: "start_timer",
        parameters: {
          type: "object",
          properties: {
            minutes: { type: "number", description: "Duration in minutes" },
            label: { type: "string", description: "Timer label" },
          },
          required: ["minutes"],
        },
      },
      {
        name: "get_timers",
        description: "List all active timers",
        handler: "get_timers",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    ],
    panels: [
      {
        id: "timer-panel",
        title: "Timers",
        icon: "Clock",
        component: "TimerPanel",
        position: "right",
      },
    ],
    settings: [
      {
        key: "sound",
        label: "Alert Sound",
        type: "boolean",
        default: true,
      },
      {
        key: "defaultMinutes",
        label: "Default Duration (min)",
        type: "number",
        default: 5,
      },
    ],
    permissions: ["notifications"],
  },
  {
    id: "calculator",
    name: "Calculator",
    version: "1.0.0",
    description: "Evaluate mathematical expressions. Supports arithmetic, parentheses, and percentages.",
    author: "Stark Industries",
    icon: "Calculator",
    tools: [
      {
        name: "calculate",
        description: "Evaluate a mathematical expression and return the result",
        handler: "calculate",
        parameters: {
          type: "object",
          properties: {
            expression: { type: "string", description: "Math expression, e.g. '2+2*3' or '(100+50)/3'" },
          },
          required: ["expression"],
        },
      },
    ],
    settings: [
      {
        key: "precision",
        label: "Decimal Precision",
        type: "number",
        default: 6,
      },
    ],
    permissions: [],
  },
];

// ── PluginManager ───────────────────────────────────────────────

export class PluginManager {
  private plugins: Map<string, PluginState> = new Map();
  private listeners: Map<PluginEventType, Set<PluginEventListener>> = new Map();

  constructor() {
    // Restore persisted plugins from localStorage
    const saved = loadFromStorage();
    for (const sp of saved) {
      this.plugins.set(sp.manifest.id, {
        manifest: sp.manifest,
        enabled: sp.enabled,
        settings: sp.settings,
      });
    }
  }

  // ── Event system ────────────────────────────────────────────

  on(event: PluginEventType, listener: PluginEventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  private emit(event: PluginEventType, pluginId: string): void {
    this.listeners.get(event)?.forEach((fn) => fn(pluginId));
  }

  // ── Persistence ────────────────────────────────────────────

  private persist(): void {
    const data: SerializedPlugin[] = Array.from(this.plugins.values()).map((p) => ({
      manifest: p.manifest,
      enabled: p.enabled,
      settings: p.settings,
    }));
    saveToStorage(data);
  }

  // ── Core lifecycle ─────────────────────────────────────────

  loadPlugin(manifest: PluginManifest, _code?: string): void {
    // If already loaded, update the manifest but keep settings/enabled state
    const existing = this.plugins.get(manifest.id);
    if (existing) {
      existing.manifest = manifest;
      // Keep existing settings that are still valid
      const newSettings: Record<string, unknown> = {};
      if (manifest.settings) {
        for (const def of manifest.settings) {
          newSettings[def.key] =
            def.key in existing.settings ? existing.settings[def.key] : def.default;
        }
      }
      existing.settings = newSettings;
    } else {
      // Initialize settings from defaults
      const settings: Record<string, unknown> = {};
      if (manifest.settings) {
        for (const def of manifest.settings) {
          settings[def.key] = def.default;
        }
      }
      this.plugins.set(manifest.id, {
        manifest,
        enabled: false,
        settings,
      });
    }
    this.persist();
    this.emit("load", manifest.id);
  }

  unloadPlugin(id: string): void {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    this.plugins.delete(id);
    this.persist();
    this.emit("unload", id);
  }

  getPlugin(id: string): PluginState | undefined {
    return this.plugins.get(id);
  }

  getAllPlugins(): PluginState[] {
    return Array.from(this.plugins.values());
  }

  setEnabled(id: string, enabled: boolean): void {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    plugin.enabled = enabled;
    this.persist();
    this.emit(enabled ? "enable" : "disable", id);
  }

  // ── Tools ──────────────────────────────────────────────────

  getPluginTools(): PluginToolDef[] {
    const tools: PluginToolDef[] = [];
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.tools) continue;
      for (const tool of plugin.manifest.tools) {
        tools.push(tool);
      }
    }
    return tools;
  }

  /**
   * Execute a plugin's tool handler.
   * TODO: For user-supplied plugins, run the handler inside a Web Worker
   * for true sandboxing instead of calling the function directly.
   */
  async executeTool(
    pluginId: string,
    toolName: string,
    params: unknown,
  ): Promise<unknown> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin || !plugin.enabled) {
      throw new Error(`Plugin "${pluginId}" is not loaded or disabled`);
    }

    const toolDef = plugin.manifest.tools?.find((t) => t.name === toolName);
    if (!toolDef) {
      throw new Error(`Tool "${toolName}" not found in plugin "${pluginId}"`);
    }

    // Try built-in handlers first
    const handlers = builtinHandlers[pluginId];
    if (handlers?.[toolName]) {
      this.emit("tool-execute", pluginId);
      return handlers[toolName](params);
    }

    // TODO: For user plugins with code, eval in sandboxed Worker
    throw new Error(
      `No handler registered for "${pluginId}:${toolName}". User plugin code execution requires Web Worker sandboxing (not yet implemented).`,
    );
  }

  // ── Panels ─────────────────────────────────────────────────

  getPluginPanels(): PluginPanelDef[] {
    const panels: PluginPanelDef[] = [];
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled || !plugin.manifest.panels) continue;
      for (const panel of plugin.manifest.panels) {
        panels.push(panel);
      }
    }
    return panels;
  }

  // ── Settings ───────────────────────────────────────────────

  getPluginSettings(pluginId: string): PluginSettingDef[] {
    return this.plugins.get(pluginId)?.manifest.settings ?? [];
  }

  getPluginSetting(pluginId: string, key: string): unknown {
    return this.plugins.get(pluginId)?.settings[key];
  }

  setPluginSetting(pluginId: string, key: string, value: unknown): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return;
    // Only allow setting keys defined in the manifest
    const def = plugin.manifest.settings?.find((s) => s.key === key);
    if (!def) return;
    plugin.settings[key] = value;
    this.persist();
    this.emit("settings-change", pluginId);
  }

  // ── Import / Export ────────────────────────────────────────

  exportPlugin(id: string): string {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin "${id}" not found`);
    return JSON.stringify(
      {
        manifest: plugin.manifest,
        enabled: plugin.enabled,
        settings: plugin.settings,
      },
      null,
      2,
    );
  }

  importPlugin(json: string): void {
    const data = JSON.parse(json) as SerializedPlugin;
    if (!data.manifest || !data.manifest.id) {
      throw new Error("Invalid plugin JSON: missing manifest with id");
    }
    this.loadPlugin(data.manifest);
    // Restore enabled state and settings from import
    const loaded = this.plugins.get(data.manifest.id);
    if (loaded) {
      loaded.enabled = data.enabled ?? false;
      loaded.settings = data.settings ?? {};
      this.persist();
    }
  }

  // ── Built-in plugin availability ───────────────────────────

  getBuiltinPlugins(): PluginManifest[] {
    return BUILTIN_PLUGINS;
  }

  isBuiltin(id: string): boolean {
    return BUILTIN_PLUGINS.some((p) => p.id === id);
  }
}

// ── Singleton ───────────────────────────────────────────────────

let _instance: PluginManager | null = null;

export function getPluginManager(): PluginManager {
  if (!_instance) {
    _instance = new PluginManager();
  }
  return _instance;
}

/** Reset singleton (useful for tests) */
export function resetPluginManager(): void {
  _instance = null;
}