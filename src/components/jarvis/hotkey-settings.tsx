"use client";

import { useState, useEffect, useCallback } from "react";
import { Switch } from "@/components/ui/switch";
import { Keyboard, RotateCcw } from "lucide-react";
import {
  DEFAULT_HOTKEYS,
  getHotkeyPresets,
  saveHotkeyPresets,
  formatHotkey,
  type HotkeyPreset,
} from "@/hooks/use-global-hotkey";

export function HotkeySettings() {
  const [presets, setPresets] = useState<HotkeyPreset[]>([]);

  useEffect(() => {
    setPresets(getHotkeyPresets());
  }, []);

  const toggleEnabled = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.map((h) =>
        h.id === id ? { ...h, enabled: !h.enabled } : h,
      );
      saveHotkeyPresets(next);
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    saveHotkeyPresets(DEFAULT_HOTKEYS);
    setPresets([...DEFAULT_HOTKEYS]);
  }, []);

  return (
    <div className="space-y-1">
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between border-b border-dashed border-primary/20 pb-2">
        <div className="flex items-center gap-2">
          <Keyboard className="h-3.5 w-3.5 text-primary/70" />
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/90">
              Global Hotkeys
            </div>
            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              System-wide keyboard shortcuts
            </div>
          </div>
        </div>
        <button
          onClick={resetDefaults}
          className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 transition hover:text-warning"
          title="Reset to defaults"
        >
          <RotateCcw className="h-2.5 w-2.5" /> Reset
        </button>
      </div>

      {/* Hotkey list */}
      <div className="space-y-1">
        {presets.map((hotkey) => (
          <div
            key={hotkey.id}
            className="flex items-center justify-between rounded-md border border-primary/10 bg-primary/3 px-3 py-2 transition hover:bg-primary/5"
          >
            <div className="flex items-center gap-3">
              {/* Key combo badge */}
              <kbd className="inline-flex items-center rounded border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary shadow-sm">
                {formatHotkey(hotkey)}
              </kbd>
              <span className="font-mono text-[11px] text-foreground/80">
                {hotkey.label}
              </span>
            </div>
            <Switch
              checked={hotkey.enabled}
              onCheckedChange={() => toggleEnabled(hotkey.id)}
              className="scale-75"
            />
          </div>
        ))}
      </div>
    </div>
  );
}