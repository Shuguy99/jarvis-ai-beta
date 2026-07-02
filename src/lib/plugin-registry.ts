"use client";

import { useState, useCallback, useEffect, type ComponentType } from "react";

// ── Types ───────────────────────────────────────────────────────────

export interface PluginSetting {
  key: string;
  label: string;
  type: "toggle" | "select" | "number" | "text";
  defaultValue: any;
  options?: string[];
}

export interface JarvisPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon: string;
  category: "system" | "productivity" | "analysis" | "fun" | "network";
  enabled: boolean;
  settings?: PluginSetting[];
  widget?: ComponentType<any>;
}

// ── Storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = "jarvis-plugins";

interface PluginState {
  [pluginId: string]: { enabled: boolean; settings?: Record<string, any> };
}

function loadState(): PluginState {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(state: PluginState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// ── Registry (module-level singleton) ──────────────────────────────

let plugins: Map<string, JarvisPlugin> = new Map();
let initialized = false;

export function registerPlugin(plugin: JarvisPlugin): void {
  const state = loadState();
  const saved = state[plugin.id];
  if (saved) {
    plugin.enabled = saved.enabled ?? plugin.enabled;
    if (saved.settings && plugin.settings) {
      for (const s of plugin.settings) {
        if (s.key in saved.settings) {
          (s as any).defaultValue = saved.settings[s.key];
        }
      }
    }
  }
  plugins.set(plugin.id, plugin);
}

export function unregisterPlugin(id: string): void {
  plugins.delete(id);
}

export function getPlugin(id: string): JarvisPlugin | undefined {
  return plugins.get(id);
}

export function getAllPlugins(): JarvisPlugin[] {
  return Array.from(plugins.values());
}

export function enablePlugin(id: string, enabled: boolean): void {
  const p = plugins.get(id);
  if (!p) return;
  p.enabled = enabled;
  const state = loadState();
  if (!state[id]) state[id] = { enabled };
  else state[id].enabled = enabled;
  saveState(state);
}

export function updatePluginSetting(id: string, key: string, value: any): void {
  const p = plugins.get(id);
  if (!p) return;
  const state = loadState();
  if (!state[id]) state[id] = { enabled: p.enabled, settings: {} };
  if (!state[id].settings) state[id].settings = {};
  state[id].settings[key] = value;
  saveState(state);
}

export function getPluginsByCategory(cat: string): JarvisPlugin[] {
  return getAllPlugins().filter((p) => p.category === cat);
}

export function getEnabledPlugins(): JarvisPlugin[] {
  return getAllPlugins().filter((p) => p.enabled);
}

// ── React Hook ──────────────────────────────────────────────────────

export function usePlugins() {
  const [, forceUpdate] = useState(0);
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  useEffect(() => {
    if (!initialized) {
      initBuiltinPlugins();
      initialized = true;
    }
    refresh();
  }, [refresh]);

  return { plugins: getAllPlugins(), refresh };
}

export function initPluginRegistry(): void {
  if (!initialized) {
    initBuiltinPlugins();
    initialized = true;
  }
}

// ── Built-in Plugins Registration ───────────────────────────────────

// Widget components are defined in plugin-widgets.tsx to avoid JSX in .ts file
let widgetLoadAttempted = false;

async function loadWidgetModules() {
  if (widgetLoadAttempted) return;
  widgetLoadAttempted = true;
  try {
    const mod = await import("@/components/jarvis/plugin-widgets");
    if (mod.SystemDoctorWidget) {
      const p = plugins.get("system-doctor");
      if (p) p.widget = mod.SystemDoctorWidget;
    }
    if (mod.NetworkScannerWidget) {
      const p = plugins.get("network-scanner");
      if (p) p.widget = mod.NetworkScannerWidget;
    }
    if (mod.QuickMemoWidget) {
      const p = plugins.get("quick-memo");
      if (p) p.widget = mod.QuickMemoWidget;
    }
  } catch {
    // Widgets not available
  }
}

function initBuiltinPlugins(): void {
  registerPlugin({
    id: "system-doctor",
    name: "System Doctor",
    description: "Диагностика системы: CPU, RAM, Disk, Network. Автопроверка каждые 30 сек.",
    version: "1.0.0",
    author: "Stark Industries",
    icon: "Stethoscope",
    category: "system",
    enabled: true,
  });

  registerPlugin({
    id: "network-scanner",
    name: "Network Scanner",
    description: "Мониторинг сетевых интерфейсов: IP, скорость загрузки/отдачи.",
    version: "1.0.0",
    author: "Stark Industries",
    icon: "Wifi",
    category: "network",
    enabled: true,
  });

  registerPlugin({
    id: "quick-memo",
    name: "Quick Memo",
    description: "Быстрая заметка с автосохранением. Всегда под рукой.",
    version: "1.0.0",
    author: "Stark Industries",
    icon: "StickyNote",
    category: "productivity",
    enabled: false,
  });

  // Load widget components asynchronously
  void loadWidgetModules();
}