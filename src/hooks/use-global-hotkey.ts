import { useEffect, useCallback, useRef } from "react";

interface GlobalHotkeyConfig {
  key: string;           // e.g. "Alt", "Control", "F9"
  code?: string;         // e.g. "KeyJ", "F9"
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  enabled?: boolean;
}

const STORAGE_KEY = "jarvis-global-hotkeys";

export interface HotkeyPreset {
  id: string;
  key: string;
  code?: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  action: string;       // "voice_toggle" | "voice_push" | "command_palette" | "settings" | "dnd_toggle" | "fullscreen"
  label: string;
  enabled: boolean;
}

export const DEFAULT_HOTKEYS: HotkeyPreset[] = [
  { id: "voice_push", key: " ", code: "Space", ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, action: "voice_push", label: "Voice input (hold)", enabled: true },
  { id: "voice_toggle", key: "v", code: "KeyV", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, action: "voice_toggle", label: "Toggle microphone", enabled: true },
  { id: "command_palette", key: "k", code: "KeyK", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, action: "command_palette", label: "Command palette", enabled: true },
  { id: "settings", key: ",", code: "Comma", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, action: "settings", label: "Open settings", enabled: true },
  { id: "dnd_toggle", key: "d", code: "KeyD", ctrlKey: true, altKey: false, shiftKey: false, metaKey: false, action: "dnd_toggle", label: "Do not disturb", enabled: true },
  { id: "fullscreen", key: "f", code: "KeyF", ctrlKey: true, altKey: false, shiftKey: true, metaKey: false, action: "fullscreen", label: "Fullscreen", enabled: true },
];

export function getHotkeyPresets(): HotkeyPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return DEFAULT_HOTKEYS;
}

export function saveHotkeyPresets(presets: HotkeyPreset[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(presets)); } catch { /* ignore */ }
}

export function formatHotkey(h: HotkeyPreset): string {
  const parts: string[] = [];
  if (h.ctrlKey) parts.push("Ctrl");
  if (h.altKey) parts.push("Alt");
  if (h.shiftKey) parts.push("Shift");
  if (h.metaKey) parts.push("Cmd");
  parts.push(h.key.length === 1 ? h.key.toUpperCase() : h.key);
  return parts.join(" + ");
}

/**
 * Hook to register a global keyboard shortcut.
 * Uses capture phase and refs to stay current without re-binding.
 */
export function useGlobalHotkey(
  callback: () => void,
  deps: unknown[] = [],
  config?: { code?: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean; enabled?: boolean }
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (config?.enabled === false) return;

    function handler(e: KeyboardEvent) {
      // Skip if user is typing in an input/textarea without modifiers
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        if (!e.ctrlKey && !e.altKey && !e.metaKey) return;
      }

      if (
        (config?.code ? e.code === config.code : true) &&
        (config?.ctrlKey ? e.ctrlKey : !e.ctrlKey) &&
        (config?.altKey ? e.altKey : !e.altKey) &&
        (config?.shiftKey ? e.shiftKey : !e.shiftKey) &&
        (config?.metaKey ? e.metaKey : !e.metaKey)
      ) {
        e.preventDefault();
        e.stopPropagation();
        callbackRef.current();
      }
    }

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [config?.code, config?.ctrlKey, config?.altKey, config?.shiftKey, config?.metaKey, config?.enabled, ...deps]);
}