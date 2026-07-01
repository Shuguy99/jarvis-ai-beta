"use client";

import { motion } from "framer-motion";
import { Mic, MicOff, Square } from "lucide-react";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";

interface VoiceControlProps {
  jarvis: UseJarvisReturn;
}

export function VoiceControl({ jarvis }: VoiceControlProps) {
  const { isRecording, toggleListening, stopSpeaking, state, audioLevel } = jarvis;
  const speaking = state === "speaking";

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Equalizer visualizer */}
      <div className="flex h-10 items-end justify-center gap-1">
        {Array.from({ length: 24 }).map((_, i) => {
          const base = isRecording ? audioLevel : speaking ? 0.3 + Math.sin(Date.now() / 120 + i) * 0.25 + 0.2 : 0.06;
          const variance = isRecording ? Math.abs(Math.sin(Date.now() / 90 + i * 0.6)) * 0.5 : 0;
          const h = Math.max(0.08, Math.min(1, base + variance));
          return (
            <motion.div
              key={i}
              className="w-1 rounded-full"
              style={{
                background: isRecording
                  ? "oklch(0.78 0.16 165)"
                  : speaking
                  ? "oklch(0.8 0.16 220)"
                  : "oklch(0.82 0.17 193 / 40%)",
              }}
              animate={{ height: `${h * 100}%` }}
              transition={{ duration: 0.08 }}
            />
          );
        })}
      </div>

      {/* Main mic button */}
      <div className="relative flex items-center justify-center">
        {(isRecording || speaking) && (
          <span
            className="absolute h-16 w-16 rounded-full border-2 anim-pulse-glow"
            style={{
              borderColor: isRecording ? "oklch(0.78 0.16 165 / 60%)" : "oklch(0.8 0.16 220 / 60%)",
            }}
          />
        )}
        {isRecording && (
          <span
            className="absolute h-20 w-20 rounded-full border anim-pulse-glow"
            style={{ borderColor: "oklch(0.78 0.16 165 / 30%)", animationDelay: "0.3s" }}
          />
        )}
        {speaking ? (
          <button
            onClick={stopSpeaking}
            className="relative flex h-14 w-14 items-center justify-center rounded-full border border-primary/50 bg-primary/20 text-primary jarvis-box-glow-strong transition hover:bg-primary/30"
            title="Остановить речь"
          >
            <Square className="h-5 w-5" fill="currentColor" />
          </button>
        ) : (
          <button
            onClick={toggleListening}
            disabled={state === "thinking"}
            className={`relative flex h-14 w-14 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isRecording
                ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-300 jarvis-box-glow-strong"
                : "border-primary/50 bg-primary/15 text-primary hover:bg-primary/25 hover:jarvis-box-glow"
            }`}
            title={isRecording ? "Остановить запись" : "Начать голосовой ввод"}
          >
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
      </div>

      <div className="text-center">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary/80">
          {isRecording ? "Recording… tap to stop" : speaking ? "Speaking…" : "Voice Input"}
        </div>
        <div className="mt-0.5 font-mono text-[9px] text-muted-foreground/60">
          {isRecording ? "Говорите чётко" : "Нажмите и говорите"}
        </div>
      </div>
    </div>
  );
}
