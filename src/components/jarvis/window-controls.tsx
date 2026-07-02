"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Square, X, Maximize2, Pin, Info } from "lucide-react";
import { playSound } from "@/lib/sounds";
import { Switch } from "@/components/ui/switch";

function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.jarvisElectron;
}

export function WindowControls() {
  const [isElectronEnv, setIsElectronEnv] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [opacity, setOpacity] = useState(100);
  const [version, setVersion] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Detect Electron environment
  useEffect(() => {
    setIsElectronEnv(isElectron());
  }, []);

  // Fetch version on mount
  useEffect(() => {
    if (!window.jarvisElectron) return;
    window.jarvisElectron.getVersion().then((v) => setVersion(v)).catch(() => {});
  }, []);

  // Close panel on outside click
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  // Listen for window events from Electron
  useEffect(() => {
    if (!window.jarvisElectron) return;
    window.jarvisElectron.onWindowEvent((event, data) => {
      if (event === "always-on-top-changed") {
        setAlwaysOnTop(!!data);
      } else if (event === "opacity-changed") {
        setOpacity(typeof data === "number" ? Math.round(data * 100) : 100);
      }
    });
  }, []);

  const handleMinimize = useCallback(() => {
    playSound("click", 0.2);
    window.jarvisElectron?.minimize();
  }, []);

  const handleMaximize = useCallback(() => {
    playSound("click", 0.2);
    window.jarvisElectron?.maximize();
  }, []);

  const handleClose = useCallback(() => {
    playSound("click", 0.2);
    window.jarvisElectron?.close();
  }, []);

  const handleAlwaysOnTop = useCallback(async (checked: boolean) => {
    playSound("click", 0.2);
    setAlwaysOnTop(checked);
    await window.jarvisElectron?.setAlwaysOnTop(checked);
  }, []);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      setOpacity(val);
      window.jarvisElectron?.setOpacity(val / 100);
    },
    [],
  );

  const handleFullscreen = useCallback(() => {
    playSound("click", 0.2);
    window.jarvisElectron?.toggleFullscreen();
  }, []);

  // If not in Electron, render a small "Desktop Mode" badge
  if (!isElectronEnv) {
    return (
      <span
        className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/40 select-none"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        BROWSER
      </span>
    );
  }

  return (
    <div
      className="relative flex items-center gap-0.5"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      {/* Settings gear / panel toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => {
          playSound("click", 0.2);
          setPanelOpen((p) => !p);
        }}
        className="flex h-7 w-7 items-center justify-center rounded bg-transparent text-muted-foreground transition hover:bg-primary/20 hover:text-foreground"
        title="Window options"
      >
        <Pin className="h-3 w-3" />
      </motion.button>

      {/* Minimize */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleMinimize}
        className="flex h-7 w-7 items-center justify-center rounded bg-transparent text-muted-foreground transition hover:bg-primary/20 hover:text-foreground"
        title="Minimize"
      >
        <Minus className="h-3.5 w-3.5" />
      </motion.button>

      {/* Maximize */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleMaximize}
        className="flex h-7 w-7 items-center justify-center rounded bg-transparent text-muted-foreground transition hover:bg-primary/20 hover:text-foreground"
        title="Maximize"
      >
        <Square className="h-3 w-3" />
      </motion.button>

      {/* Close */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClose}
        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-destructive/80 hover:text-white"
        title="Close"
      >
        <X className="h-3.5 w-3.5" />
      </motion.button>

      {/* Additional controls dropdown panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border p-3 shadow-lg"
            style={{
              backgroundColor: "oklch(0.15 0.02 250)",
              borderColor: "oklch(0.4 0.1 193)",
              WebkitAppRegion: "no-drag",
            }}
          >
            <div className="space-y-3">
              {/* Always on Top */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="aot-toggle"
                  className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground select-none"
                >
                  Always on Top
                </label>
                <Switch
                  id="aot-toggle"
                  checked={alwaysOnTop}
                  onCheckedChange={handleAlwaysOnTop}
                  className="scale-75 origin-right"
                />
              </div>

              {/* Opacity */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground select-none">
                    Opacity
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-primary/70 select-none">
                    {opacity}%
                  </span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={100}
                  step={5}
                  value={opacity}
                  onChange={handleOpacityChange}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
                />
              </div>

              {/* Fullscreen */}
              <button
                onClick={handleFullscreen}
                className="flex w-full items-center gap-2 rounded border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                style={{ borderColor: "oklch(0.4 0.1 193 / 40%)" }}
              >
                <Maximize2 className="h-3 w-3" />
                Fullscreen
              </button>

              {/* Version */}
              {version && (
                <div className="flex items-center gap-1.5 border-t pt-2" style={{ borderColor: "oklch(0.4 0.1 193 / 20%)" }}>
                  <Info className="h-3 w-3 text-muted-foreground/50" />
                  <span className="font-mono text-[10px] text-muted-foreground/50 select-none">
                    JARVIS v{version}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}