

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutPanelLeft,
  Timer,
  Palette,
  Maximize2,
  MessageSquarePlus,
  Camera,
  StickyNote,
  Volume2,
  Search,
  CloudSun,
  Clock,
  Activity,
  Eye,
  ImageIcon,
  Focus,
  Calculator,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import type { ParsedCommand } from "@/lib/voice-commands";

// ── Intent → icon mapping ─────────────────────────────────────

const INTENT_ICON: Record<string, LucideIcon> = {
  open_widget: LayoutPanelLeft,
  set_timer: Timer,
  toggle_theme: Palette,
  toggle_fullscreen: Maximize2,
  new_chat: MessageSquarePlus,
  capture_screen: Camera,
  toggle_notes: StickyNote,
  toggle_voice: Volume2,
  search_web: Search,
  get_weather: CloudSun,
  get_time: Clock,
  system_status: Activity,
  analyze_image: Eye,
  generate_image: ImageIcon,
  start_pomodoro: Focus,
  calculator: Calculator,
};

// ── Component ─────────────────────────────────────────────────

export function VoiceCommandOverlay({
  command,
}: {
  command: ParsedCommand | null;
}) {
  // Play "activate" sound when overlay appears
  useEffect(() => {
    if (command) {
      playSound("activate");
    }
  }, [command]);

  const Icon = command ? (INTENT_ICON[command.intent] ?? Zap) : Zap;
  const confidencePercent = command ? Math.round(command.confidence * 100) : 0;

  return (
    <AnimatePresence>
      {command && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="jarvis-glass-strong jarvis-border-cyan jarvis-box-glow fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
          style={{ minWidth: 280 }}
        >
          <div className="flex items-center gap-3 px-5 py-3.5">
            {/* Intent icon with glow */}
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
              <Icon className="h-5 w-5 text-primary jarvis-glow" />
            </div>

            {/* Display text + confidence */}
            <div className="flex flex-1 flex-col gap-1.5">
              {/* Label */}
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary/60">
                КОМАНДА ПРИНЯТА
              </span>

              {/* Display text */}
              <span className="font-mono text-sm font-semibold text-foreground">
                {command.display}
              </span>

              {/* Confidence bar */}
              <div className="flex items-center gap-2">
                <div className="h-1 w-24 overflow-hidden rounded-full bg-primary/10">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${confidencePercent}%` }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                </div>
                <span className="font-mono text-[9px] tabular-nums text-muted-foreground/60">
                  {confidencePercent}%
                </span>
              </div>
            </div>

            {/* Intent name tag */}
            <span className="flex-shrink-0 rounded border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary/70">
              {command.intent}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}