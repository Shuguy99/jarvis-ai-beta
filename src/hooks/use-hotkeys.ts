"use client";

import { useEffect, useCallback } from "react";

export interface HotkeyConfig {
  onToggleTimer?: () => void;
  onToggleCalc?: () => void;
  onToggleNotes?: () => void;
  onOpenSettings?: () => void;
  onNewChat?: () => void;
  onToggleVoice?: () => void;
  onToggleFullscreen?: () => void;
  onOpenPalette?: () => void;
}

export function useHotkeys(config: HotkeyConfig) {
  const handler = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const alt = e.altKey;

    // Ctrl+K — Command Palette (already handled by cmdk, but add fallback)
    if (ctrl && e.key === "k") {
      e.preventDefault();
      config.onOpenPalette?.();
      return;
    }

    // Ctrl+1 — Toggle Timer
    if (ctrl && !shift && !alt && e.key === "1") {
      e.preventDefault();
      config.onToggleTimer?.();
      return;
    }

    // Ctrl+2 — Toggle Calculator
    if (ctrl && !shift && !alt && e.key === "2") {
      e.preventDefault();
      config.onToggleCalc?.();
      return;
    }

    // Ctrl+N — Toggle Notes
    if (ctrl && !shift && !alt && e.key === "n") {
      e.preventDefault();
      config.onToggleNotes?.();
      return;
    }

    // Ctrl+/ or Ctrl+, — Settings
    if (ctrl && (e.key === "/" || e.key === ",")) {
      e.preventDefault();
      config.onOpenSettings?.();
      return;
    }

    // Ctrl+Shift+N — New Chat
    if (ctrl && shift && e.key === "N") {
      e.preventDefault();
      config.onNewChat?.();
      return;
    }

    // Ctrl+V — Toggle Voice (only when not in input)
    if (ctrl && !shift && e.key === "v") {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        config.onToggleVoice?.();
      }
      return;
    }

    // F11 or Ctrl+Shift+F — Fullscreen
    if (e.key === "F11" || (ctrl && shift && e.key === "F")) {
      e.preventDefault();
      config.onToggleFullscreen?.();
      return;
    }

    // Escape — close any open panel
    if (e.key === "Escape") {
      // Let components handle their own escape
      return;
    }
  }, [config]);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}