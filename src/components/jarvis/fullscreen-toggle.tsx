"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize } from "lucide-react";
import { playSound } from "@/lib/sounds";

export function FullscreenToggle() {
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    const handler = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggle = useCallback(async () => {
    playSound(isFull ? "deactivate" : "activate");
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      /* fullscreen not supported */
    }
  }, [isFull]);

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:jarvis-box-glow"
      title={isFull ? "Выйти из полноэкранного режима" : "Полноэкранный режим"}
    >
      {isFull ? <Minimize className="h-3 w-3" /> : <Maximize className="h-3 w-3" />}
      <span className="hidden sm:inline">{isFull ? "Exit" : "Fullscreen"}</span>
    </button>
  );
}