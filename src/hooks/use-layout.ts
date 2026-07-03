"use client";

import { useState, useCallback, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WidgetLayout {
  id: string;
  name: string;
  visible: boolean;
  position: "left" | "center" | "right";
  order: number;
  /** Если true — виджет нельзя скрыть или переместить */
  pinned?: boolean;
}

export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  layout: WidgetLayout[];
}

// ─── Default widgets list ───────────────────────────────────────────────────

function buildDefaultWidgets(): WidgetLayout[] {
  return [
    // Left sidebar
    { id: "quick-launch", name: "Quick Launch", visible: true, position: "left", order: 0 },
    { id: "system-monitor", name: "System Monitor", visible: true, position: "left", order: 1 },
    { id: "activity-feed", name: "Activity Feed", visible: true, position: "left", order: 2 },
    { id: "system-alerts", name: "System Alerts", visible: true, position: "left", order: 3 },
    { id: "holo-globe", name: "Holo Globe", visible: true, position: "left", order: 4 },
    { id: "session-stats", name: "Session Stats", visible: true, position: "left", order: 5 },
    { id: "shortcuts", name: "Shortcuts", visible: true, position: "left", order: 6 },
    { id: "file-explorer", name: "File Explorer", visible: true, position: "left", order: 7 },
    { id: "calendar", name: "Calendar", visible: true, position: "left", order: 8 },
    { id: "conversations", name: "Conversations", visible: true, position: "left", order: 9 },
    // Center (always visible, pinned)
    { id: "arc-reactor", name: "Arc Reactor", visible: true, position: "center", order: 0, pinned: true },
    { id: "chat", name: "Chat", visible: true, position: "center", order: 1, pinned: true },
    // Right sidebar
    { id: "capabilities", name: "Capabilities", visible: true, position: "right", order: 0 },
    { id: "weather", name: "Weather", visible: true, position: "right", order: 1 },
    { id: "world-clock", name: "World Clock", visible: true, position: "right", order: 2 },
    { id: "music-player", name: "Music Player", visible: true, position: "right", order: 3 },
    { id: "clipboard", name: "Clipboard", visible: true, position: "right", order: 4 },
    { id: "network", name: "Network", visible: true, position: "right", order: 5 },
    { id: "process-manager", name: "Process Manager", visible: true, position: "right", order: 6 },
    { id: "ambient-sound", name: "Ambient Sound", visible: true, position: "right", order: 7 },
    { id: "pomodoro", name: "Pomodoro", visible: true, position: "right", order: 8 },
    { id: "timer", name: "Timer", visible: true, position: "right", order: 9 },
    { id: "calculator", name: "Calculator", visible: true, position: "right", order: 10 },
    { id: "todo", name: "Todo", visible: true, position: "right", order: 11 },
    { id: "directives", name: "Directives", visible: true, position: "right", order: 12 },
  ];
}

// ─── Presets ─────────────────────────────────────────────────────────────────

function buildPresets(defaultWidgets: WidgetLayout[]): LayoutPreset[] {
  return [
    {
      id: "full-hud",
      name: "Полный HUD",
      description: "Все виджеты видны — максимальная информативность",
      icon: "Monitor",
      layout: defaultWidgets.map((w) => ({ ...w, visible: true })),
    },
    {
      id: "minimal",
      name: "Минимал",
      description: "Только самое необходимое: мониторинг, чат, погода",
      icon: "Minimize2",
      layout: defaultWidgets.map((w) => ({
        ...w,
        visible: ["system-monitor", "chat", "quick-launch", "weather", "world-clock", "arc-reactor"].includes(w.id),
      })),
    },
    {
      id: "developer",
      name: "Разработка",
      description: "Инструменты разработчика: мониторинг, файлы, процессы",
      icon: "Code",
      layout: defaultWidgets.map((w) => ({
        ...w,
        visible: [
          "system-monitor",
          "process-manager",
          "file-explorer",
          "chat",
          "network",
          "activity-feed",
          "conversations",
          "arc-reactor",
        ].includes(w.id),
      })),
    },
    {
      id: "focus",
      name: "Фокус",
      description: "Концентрация: чат, таймеры, звук, календарь",
      icon: "Target",
      layout: defaultWidgets.map((w) => ({
        ...w,
        visible: [
          "chat",
          "pomodoro",
          "timer",
          "ambient-sound",
          "calendar",
          "todo",
          "arc-reactor",
        ].includes(w.id),
      })),
    },
    {
      id: "monitoring",
      name: "Мониторинг",
      description: "Системное наблюдение: ресурсы, алерты, сеть, погода",
      icon: "Activity",
      layout: defaultWidgets.map((w) => ({
        ...w,
        visible: [
          "system-monitor",
          "system-alerts",
          "process-manager",
          "network",
          "weather",
          "activity-feed",
          "chat",
          "arc-reactor",
        ].includes(w.id),
      })),
    },
  ];
}

// ─── LocalStorage helpers ───────────────────────────────────────────────────

const STORAGE_KEY = "jarvis-layout";

interface StoredLayout {
  widgets: WidgetLayout[];
  activePresetId: string;
}

function loadFromStorage(defaultWidgets: WidgetLayout[]): StoredLayout {
  if (typeof window === "undefined") {
    return { widgets: defaultWidgets, activePresetId: "full-hud" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { widgets: defaultWidgets, activePresetId: "full-hud" };
    const parsed = JSON.parse(raw) as StoredLayout;
    // Merge with defaults — add missing widgets, remove deleted ones
    const storedIds = new Set(parsed.widgets.map((w) => w.id));
    const defaultIds = new Set(defaultWidgets.map((w) => w.id));

    const merged = defaultWidgets.map((dw) => {
      const stored = parsed.widgets.find((w) => w.id === dw.id);
      if (stored) {
        // Keep stored visibility & position, but respect pinned
        return {
          ...dw,
          visible: dw.pinned ? true : stored.visible,
          position: dw.pinned ? dw.position : stored.position,
          order: stored.order ?? dw.order,
        };
      }
      return dw;
    });

    return {
      widgets: merged,
      activePresetId: parsed.activePresetId ?? "full-hud",
    };
  } catch {
    return { widgets: defaultWidgets, activePresetId: "full-hud" };
  }
}

function saveToStorage(widgets: WidgetLayout[], activePresetId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ widgets, activePresetId }));
  } catch {
    /* quota exceeded — silent fail */
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

const DEFAULT_WIDGETS = buildDefaultWidgets();
const PRESETS = buildPresets(DEFAULT_WIDGETS);

export function useLayout() {

  const [widgets, setWidgets] = useState<WidgetLayout[]>(() => loadFromStorage(DEFAULT_WIDGETS).widgets);
  const [activePresetId, setActivePresetId] = useState(() => loadFromStorage(DEFAULT_WIDGETS).activePresetId);
  const [initialized] = useState(true);

  // Auto-save on change
  useEffect(() => {
    if (!initialized) return;
    saveToStorage(widgets, activePresetId);
  }, [widgets, activePresetId, initialized]);

  const setWidgetVisible = useCallback((id: string, visible: boolean) => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id && !w.pinned ? { ...w, visible } : w
      )
    );
    // Deselect preset when manually changing
    setActivePresetId("custom");
  }, []);

  const setWidgetPosition = useCallback((id: string, position: "left" | "center" | "right") => {
    setWidgets((prev) =>
      prev.map((w) =>
        w.id === id && !w.pinned ? { ...w, position } : w
      )
    );
    setActivePresetId("custom");
  }, []);

  const moveWidget = useCallback((id: string, direction: "up" | "down") => {
    setWidgets((prev) => {
      const widget = prev.find((w) => w.id === id);
      if (!widget || widget.pinned) return prev;

      // Get siblings in same position
      const siblings = prev
        .filter((w) => w.position === widget.position)
        .sort((a, b) => a.order - b.order);

      const idx = siblings.findIndex((w) => w.id === id);
      if (direction === "up" && idx <= 0) return prev;
      if (direction === "down" && idx >= siblings.length - 1) return prev;

      // Swap orders
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      const swapWidget = siblings[swapIdx];

      return prev.map((w) => {
        if (w.id === id) return { ...w, order: swapWidget.order };
        if (w.id === swapWidget.id) return { ...w, order: widget.order };
        return w;
      });
    });
    setActivePresetId("custom");
  }, []);

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = PRESETS.find((p) => p.id === presetId);
      if (!preset) return;

      // Merge preset visibility/position onto default widgets (preserve pinned)
      const newWidgets = DEFAULT_WIDGETS.map((dw) => {
        const pw = preset.layout.find((w) => w.id === dw.id);
        if (pw) {
          return {
            ...dw,
            visible: dw.pinned ? true : pw.visible,
            position: dw.pinned ? dw.position : pw.position,
          };
        }
        return dw;
      });

      setWidgets(newWidgets);
      setActivePresetId(presetId);
    },
    []
  );

  const resetToDefault = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS.map((w) => ({ ...w, visible: true })));
    setActivePresetId("full-hud");
  }, []);

  return {
    widgets,
    setWidgetVisible,
    setWidgetPosition,
    moveWidget,
    applyPreset,
    presets: PRESETS,
    activePresetId,
    resetToDefault,
  } as const;
}