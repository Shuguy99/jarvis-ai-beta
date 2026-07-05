// ============================================================
// JARVIS UI Store — Global panel/dialog state via Zustand
// Extracted from page.tsx to eliminate prop drilling and
// reduce re-renders from co-located useState calls.
// ============================================================

import { create } from "zustand";
import type { JarvisSettingsData } from "@/components/jarvis/settings-panel";
import { PERSONAS, type Persona } from "@/lib/personas";

// ── Panel visibility state ─────────────────────────────────────

interface PanelState {
  booted: boolean;
  wakeWordEnabled: boolean;
  privacyWizardShown: boolean;
  notesOpen: boolean;
  timerVisible: boolean;
  calcVisible: boolean;
  paletteOpen: boolean;
  settingsOpen: boolean;
  markdownOpen: boolean;
  agentOpen: boolean;
  pluginOpen: boolean;
  layoutOpen: boolean;
  notifOpen: boolean;
  searchOpen: boolean;
  dndMode: boolean;
  quietMode: boolean;
  incognitoMode: boolean;
  themeEditorOpen: boolean;
  analyticsOpen: boolean;
  briefingOpen: boolean;
  jarvisSettings: JarvisSettingsData | null;
  leftWidgetIds: string[];
  rightWidgetIds: string[];
  activePersonaId: string;
}

interface PanelActions {
  setBooted: (v: boolean) => void;
  setWakeWordEnabled: (v: boolean | ((prev: boolean) => boolean)) => void;
  setPrivacyWizardShown: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleNotes: () => void;
  setNotesOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setTimerVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleTimer: () => void;
  setCalcVisible: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleCalc: () => void;
  setPaletteOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  togglePalette: () => void;
  setSettingsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setMarkdownOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setAgentOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setPluginOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setLayoutOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setNotifOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleNotif: () => void;
  setSearchOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setDndMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleDnd: () => void;
  setQuietMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleQuietMode: () => void;
  setIncognitoMode: (v: boolean | ((prev: boolean) => boolean)) => void;
  toggleIncognitoMode: () => void;
  setThemeEditorOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setAnalyticsOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setBriefingOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  setJarvisSettings: (s: JarvisSettingsData | null) => void;
  setLeftWidgetIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  setRightWidgetIds: (ids: string[] | ((prev: string[]) => string[])) => void;
  closeAllPanels: () => void;
  setActivePersonaId: (id: string) => void;
  cyclePersona: () => void;
}

const DEFAULT_LEFT_WIDGETS = [
  "quick-launch", "system-monitor", "metrics-history", "activity-feed",
  "system-alerts", "holo-globe", "session-stats", "shortcuts",
  "file-explorer", "calendar",
];

const DEFAULT_RIGHT_WIDGETS = [
  "weather", "world-clock", "music-player", "clipboard", "network",
  "process-manager", "ambient-sound", "pomodoro", "todo",
];

// Helper to handle both value and updater-function patterns
function apply<T>(v: T | ((prev: T) => T), prev: T): T {
  return typeof v === "function" ? (v as (prev: T) => T)(prev) : v;
}

export const useUIStore = create<PanelState & PanelActions>()((set) => ({
  // State
  booted: false,
  wakeWordEnabled: false,
  privacyWizardShown: typeof window !== "undefined" ? (() => { try { return JSON.parse(localStorage.getItem("jarvis-privacy-wizard-shown") || "false"); } catch { return false; } })() : false,
  notesOpen: false,
  timerVisible: true,
  calcVisible: false,
  paletteOpen: false,
  settingsOpen: false,
  markdownOpen: false,
  agentOpen: false,
  pluginOpen: false,
  layoutOpen: false,
  notifOpen: false,
  searchOpen: false,
  dndMode: false,
  quietMode: false,
  incognitoMode: false,
  themeEditorOpen: false,
  analyticsOpen: false,
  briefingOpen: false,
  jarvisSettings: null,
  leftWidgetIds: [...DEFAULT_LEFT_WIDGETS],
  rightWidgetIds: [...DEFAULT_RIGHT_WIDGETS],
  activePersonaId: "classic",

  // Actions
  setBooted: (v) => set({ booted: v }),
  setWakeWordEnabled: (v) => set((s) => ({ wakeWordEnabled: apply(v, s.wakeWordEnabled) })),
  setPrivacyWizardShown: (v) => set((s) => {
    const next = apply(v, s.privacyWizardShown);
    try { localStorage.setItem("jarvis-privacy-wizard-shown", JSON.stringify(next)); } catch { /* ignore */ }
    return { privacyWizardShown: next };
  }),
  toggleNotes: () => set((s) => ({ notesOpen: !s.notesOpen })),
  setNotesOpen: (v) => set((s) => ({ notesOpen: apply(v, s.notesOpen) })),
  setTimerVisible: (v) => set((s) => ({ timerVisible: apply(v, s.timerVisible) })),
  toggleTimer: () => set((s) => ({ timerVisible: !s.timerVisible })),
  setCalcVisible: (v) => set((s) => ({ calcVisible: apply(v, s.calcVisible) })),
  toggleCalc: () => set((s) => ({ calcVisible: !s.calcVisible })),
  setPaletteOpen: (v) => set((s) => ({ paletteOpen: apply(v, s.paletteOpen) })),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  setSettingsOpen: (v) => set((s) => ({ settingsOpen: apply(v, s.settingsOpen) })),
  setMarkdownOpen: (v) => set((s) => ({ markdownOpen: apply(v, s.markdownOpen) })),
  setAgentOpen: (v) => set((s) => ({ agentOpen: apply(v, s.agentOpen) })),
  setPluginOpen: (v) => set((s) => ({ pluginOpen: apply(v, s.pluginOpen) })),
  setLayoutOpen: (v) => set((s) => ({ layoutOpen: apply(v, s.layoutOpen) })),
  setNotifOpen: (v) => set((s) => ({ notifOpen: apply(v, s.notifOpen) })),
  toggleNotif: () => set((s) => ({ notifOpen: !s.notifOpen })),
  setSearchOpen: (v) => set((s) => ({ searchOpen: apply(v, s.searchOpen) })),
  setDndMode: (v) => set((s) => ({ dndMode: apply(v, s.dndMode) })),
  toggleDnd: () => set((s) => ({ dndMode: !s.dndMode })),
  setQuietMode: (v) => set((s) => ({ quietMode: apply(v, s.quietMode) })),
  toggleQuietMode: () => set((s) => ({ quietMode: !s.quietMode })),
  setIncognitoMode: (v) => set((s) => ({ incognitoMode: apply(v, s.incognitoMode) })),
  toggleIncognitoMode: () => set((s) => ({ incognitoMode: !s.incognitoMode })),
  setThemeEditorOpen: (v) => set((s) => ({ themeEditorOpen: apply(v, s.themeEditorOpen) })),
  setAnalyticsOpen: (v) => set((s) => ({ analyticsOpen: apply(v, s.analyticsOpen) })),
  setBriefingOpen: (v) => set((s) => ({ briefingOpen: apply(v, s.briefingOpen) })),
  setJarvisSettings: (s) => set({ jarvisSettings: s }),
  setLeftWidgetIds: (ids) => set((s) => ({ leftWidgetIds: apply(ids, s.leftWidgetIds) })),
  setRightWidgetIds: (ids) => set((s) => ({ rightWidgetIds: apply(ids, s.rightWidgetIds) })),
  setActivePersonaId: (id) => set({ activePersonaId: id }),
  cyclePersona: () => set((s) => {
    const currentIdx = PERSONAS.findIndex(p => p.id === s.activePersonaId);
    const nextIdx = (currentIdx + 1) % PERSONAS.length;
    return { activePersonaId: PERSONAS[nextIdx].id };
  }),
  closeAllPanels: () => set({
    paletteOpen: false,
    settingsOpen: false,
    notesOpen: false,
    markdownOpen: false,
    agentOpen: false,
    pluginOpen: false,
    layoutOpen: false,
    notifOpen: false,
    analyticsOpen: false,
    briefingOpen: false,
  }),
}));