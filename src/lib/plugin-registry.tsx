"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Check, X, Wifi, Cable, StickyNote } from "lucide-react";
import { useSystemData, type SystemData } from "@/hooks/use-system-poller";

// ── Types ─────────────────────────────────────────────────────────

export interface PluginSetting {
  key: string;
  label: string;
  type: "toggle" | "select" | "number" | "text";
  defaultValue: unknown;
  options?: string[];
}

export interface JarvisPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon: string; // lucide icon name
  category: "system" | "productivity" | "analysis" | "fun" | "network";
  enabled: boolean;
  settings?: PluginSetting[];
  widget?: React.ComponentType<Record<string, never>>;
}

// ── Persistence helpers ──────────────────────────────────────────

const STORAGE_KEY = "jarvis-plugins";
const SETTINGS_PREFIX = "jarvis-plugin-settings-";

function loadPlugins(): JarvisPlugin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as JarvisPlugin[];
  } catch {
    return [];
  }
}

function savePlugins(plugins: JarvisPlugin[]): void {
  if (typeof window === "undefined") return;
  try {
    // Serialize without widget references (not JSON-safe)
    const serializable = plugins.map(({ widget: _, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    /* ignore */
  }
}

function loadSettingOverrides(pluginId: string): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SETTINGS_PREFIX + pluginId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSettingOverrides(pluginId: string, overrides: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_PREFIX + pluginId, JSON.stringify(overrides));
  } catch {
    /* ignore */
  }
}

// ── Module-level state ───────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();
let plugins: JarvisPlugin[] = [];
let initialized = false;

function notify(): void {
  for (const fn of listeners) fn();
}

function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── Registry API ─────────────────────────────────────────────────

export function registerPlugin(plugin: JarvisPlugin): void {
  const idx = plugins.findIndex((p) => p.id === plugin.id);
  if (idx >= 0) {
    // Preserve enabled state and settings overrides from persistence
    const existing = plugins[idx];
    plugins[idx] = {
      ...plugin,
      enabled: existing.enabled ?? plugin.enabled,
    };
  } else {
    plugins.push(plugin);
  }
  savePlugins(plugins);
  notify();
}

export function unregisterPlugin(id: string): void {
  plugins = plugins.filter((p) => p.id !== id);
  savePlugins(plugins);
  notify();
}

export function getPlugin(id: string): JarvisPlugin | undefined {
  return plugins.find((p) => p.id === id);
}

export function getAllPlugins(): JarvisPlugin[] {
  return [...plugins];
}

export function getEnabledPlugins(): JarvisPlugin[] {
  return plugins.filter((p) => p.enabled);
}

export function getPluginsByCategory(cat: string): JarvisPlugin[] {
  if (cat === "all") return [...plugins];
  return plugins.filter((p) => p.category === cat);
}

export function enablePlugin(id: string, enabled: boolean): void {
  const plugin = plugins.find((p) => p.id === id);
  if (plugin) {
    plugin.enabled = enabled;
    savePlugins(plugins);
    notify();
  }
}

export function updatePluginSetting(id: string, key: string, value: unknown): void {
  const plugin = plugins.find((p) => p.id === id);
  if (plugin) {
    const overrides = loadSettingOverrides(id);
    overrides[key] = value;
    saveSettingOverrides(id, overrides);
    notify();
  }
}

export function getPluginSetting(id: string, key: string): unknown {
  const plugin = plugins.find((p) => p.id === id);
  if (!plugin) return undefined;
  const overrides = loadSettingOverrides(id);
  if (key in overrides) return overrides[key];
  const setting = plugin.settings?.find((s) => s.key === key);
  return setting?.defaultValue;
}

/** Subscribe to plugin registry changes */
export function usePlugins(): JarvisPlugin[] {
  const [, setTick] = useState(0);
  useEffect(() => {
    return subscribe(() => setTick((t) => t + 1));
  }, []);
  return plugins;
}

/** Initialize registry from localStorage and register built-in plugins */
export function initPluginRegistry(): void {
  if (initialized) return;
  initialized = true;

  // Load persisted state
  const persisted = loadPlugins();
  const persistedIds = new Set(persisted.map((p) => p.id));

  // Register built-in plugins
  registerBuiltinPlugins(persisted, persistedIds);
}

// ── Built-in Plugin: System Doctor ────────────────────────────────

interface DiagnosticItem {
  label: string;
  ok: boolean | null;
  detail: string;
}

function SystemDoctorWidget() {
  const [items, setItems] = useState<DiagnosticItem[]>([
    { label: "ЦП", ok: null, detail: "Проверка..." },
    { label: "ОЗУ", ok: null, detail: "Проверка..." },
    { label: "Диск", ok: null, detail: "Проверка..." },
    { label: "Сеть", ok: null, detail: "Проверка..." },
  ]);
  const [lastUpdate, setLastUpdate] = useState<string>("—");

  const checkSystem = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/system", { cache: "no-store" });
      if (!res.ok) throw new Error("fetch failed");
      const data: SystemData = await res.json();

      const cpuOk = data.cpuLoad < 90;
      const ramOk = data.memPct < 90;
      const diskOk = data.diskPct < 90;
      const netOk = data.netThroughput > 0;

      setItems([
        { label: "ЦП", ok: cpuOk, detail: `Загрузка: ${data.cpuLoad.toFixed(1)}%` },
        { label: "ОЗУ", ok: ramOk, detail: `${data.memPct.toFixed(1)}% (${(data.memUsed / 1_073_741_824).toFixed(1)}/${(data.memTotal / 1_073_741_824).toFixed(1)} ГБ)` },
        { label: "Диск", ok: diskOk, detail: `${data.diskPct.toFixed(1)}% занято` },
        { label: "Сеть", ok: netOk, detail: netOk ? "Подключено" : "Нет связи" },
      ]);
      setLastUpdate(new Date().toLocaleTimeString("ru-RU"));
    } catch {
      setItems([
        { label: "ЦП", ok: false, detail: "Ошибка" },
        { label: "ОЗУ", ok: false, detail: "Ошибка" },
        { label: "Диск", ok: false, detail: "Ошибка" },
        { label: "Сеть", ok: false, detail: "Ошибка" },
      ]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkSystem();
    const id = setInterval(() => void checkSystem(), 30_000);
    return () => clearInterval(id);
  }, [checkSystem]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">
          Диагностика системы
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/50">
          {lastUpdate}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 rounded-md border border-primary/10 bg-background/40 px-2.5 py-1.5"
          >
            {item.ok === null ? (
              <div className="h-3.5 w-3.5 animate-pulse rounded-full border border-primary/30" />
            ) : item.ok ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <X className="h-3.5 w-3.5 text-rose-400" />
            )}
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[10px] font-semibold text-foreground/80">
                {item.label}
              </div>
              <div className="font-mono text-[8px] text-muted-foreground/60 truncate">
                {item.detail}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Built-in Plugin: Network Scanner ──────────────────────────────

function NetworkScannerWidget() {
  const { system } = useSystemData();

  if (!system) {
    return (
      <div className="flex h-20 items-center justify-center font-mono text-[10px] text-muted-foreground">
        <span className="animate-pulse">Загрузка данных сети...</span>
      </div>
    );
  }

  const interfaces = system.networkInterfaces.filter((i) => !i.internal);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">
          Сетевые интерфейсы
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/50">
          {interfaces.length} активных
        </span>
      </div>

      {interfaces.length === 0 ? (
        <div className="font-mono text-[10px] text-muted-foreground/60 py-2 text-center">
          Интерфейсы не найдены
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {interfaces.map((iface, idx) => {
            const isWifi = /wlan|wi-fi|wifi|wlp/i.test(iface.name);
            const IfaceIcon = isWifi ? Wifi : Cable;
            return (
              <div
                key={`${iface.name}-${iface.family}-${idx}`}
                className="flex items-center gap-2 rounded-md border border-primary/10 bg-background/40 px-2.5 py-1.5"
              >
                <IfaceIcon className="h-3.5 w-3.5 flex-shrink-0 text-primary/60" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] font-semibold text-foreground/80 truncate">
                    {iface.name}
                    <span className="ml-1.5 text-[8px] text-muted-foreground/50">
                      {iface.family}
                    </span>
                  </div>
                  <div className="font-mono text-[8px] text-muted-foreground/60 truncate">
                    {iface.address}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Speed info */}
      <div className="flex items-center justify-between border-t border-primary/10 pt-1.5 px-1">
        <span className="font-mono text-[9px] text-emerald-400/80">
          ↓ {system.netSpeedIn.toFixed(1)} Мб/с
        </span>
        <span className="font-mono text-[9px] text-primary/80">
          ↑ {system.netSpeedOut.toFixed(1)} Мб/с
        </span>
      </div>
    </div>
  );
}

// ── Built-in Plugin: Quick Memo ───────────────────────────────────

const MEMO_KEY = "jarvis-plugin-quick-memo";
const MEMO_MAX = 280;

function QuickMemoWidget() {
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(MEMO_KEY) ?? "";
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= MEMO_MAX) {
      setText(val);
      localStorage.setItem(MEMO_KEY, val);
    }
  }, []);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-primary/70">
        Быстрая заметка
      </span>
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Введите заметку..."
        rows={4}
        className="w-full resize-none rounded-md border border-primary/15 bg-background/50 px-2.5 py-2 font-mono text-[11px] text-foreground/80 placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none jarvis-scroll"
      />
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-1">
          <StickyNote className="h-3 w-3 text-primary/40" />
          <span className="font-mono text-[8px] text-muted-foreground/40">
            Сохраняется автоматически
          </span>
        </div>
        <span
          className={`font-mono text-[9px] tabular-nums ${text.length >= MEMO_MAX ? "text-rose-400" : "text-muted-foreground/40"}`}
        >
          {text.length}/{MEMO_MAX}
        </span>
      </div>
    </div>
  );
}

// ── Register built-in plugins ─────────────────────────────────────

function registerBuiltinPlugins(
  persisted: JarvisPlugin[],
  persistedIds: Set<string>
): void {
  // System Doctor
  const systemDoctor: JarvisPlugin = {
    id: "system-doctor",
    name: "Системный доктор",
    description: "Автоматическая диагностика: ЦП, ОЗУ, диск и сеть. Обновление каждые 30 секунд.",
    version: "1.0.0",
    author: "JARVIS Core",
    icon: "Stethoscope",
    category: "system",
    enabled: true,
    settings: [
      { key: "autoRefresh", label: "Авто-обновление", type: "toggle", defaultValue: true },
      { key: "refreshInterval", label: "Интервал (сек)", type: "number", defaultValue: 30 },
    ],
    widget: SystemDoctorWidget,
  };

  // Network Scanner
  const networkScanner: JarvisPlugin = {
    id: "network-scanner",
    name: "Сканер сети",
    description: "Отображение активных сетевых интерфейсов, IP-адресов и скорости обмена данными.",
    version: "1.0.0",
    author: "JARVIS Core",
    icon: "Wifi",
    category: "network",
    enabled: true,
    widget: NetworkScannerWidget,
  };

  // Quick Memo
  const quickMemo: JarvisPlugin = {
    id: "quick-memo",
    name: "Быстрая заметка",
    description: "Простая стикер-заметка для быстрых записей. Сохраняется в localStorage.",
    version: "1.0.0",
    author: "JARVIS Core",
    icon: "StickyNote",
    category: "productivity",
    enabled: true,
    settings: [
      { key: "maxChars", label: "Макс. символов", type: "number", defaultValue: 280 },
    ],
    widget: QuickMemoWidget,
  };

  const builtins = [systemDoctor, networkScanner, quickMemo];

  for (const bp of builtins) {
    const existing = persisted.find((p) => p.id === bp.id);
    if (existing) {
      // Merge: keep persisted enabled state, attach widget
      registerPlugin({ ...bp, enabled: existing.enabled });
    } else {
      registerPlugin(bp);
    }
  }
}