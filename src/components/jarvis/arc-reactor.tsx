"use client";

import { motion } from "framer-motion";
import type { JarvisState } from "@/hooks/use-jarvis";

interface ArcReactorProps {
  state: JarvisState;
  audioLevel: number; // 0..1
  size?: number;
}

const STATE_COLORS: Record<JarvisState, { ring: string; glow: string; label: string }> = {
  idle: { ring: "oklch(0.82 0.17 193)", glow: "oklch(0.82 0.17 193 / 45%)", label: "ONLINE" },
  listening: { ring: "oklch(0.78 0.16 165)", glow: "oklch(0.78 0.16 165 / 55%)", label: "LISTENING" },
  thinking: { ring: "oklch(0.82 0.14 80)", glow: "oklch(0.82 0.14 80 / 55%)", label: "PROCESSING" },
  speaking: { ring: "oklch(0.8 0.16 220)", glow: "oklch(0.8 0.16 220 / 55%)", label: "SPEAKING" },
  error: { ring: "oklch(0.65 0.22 22)", glow: "oklch(0.65 0.22 22 / 55%)", label: "ERROR" },
};

export function ArcReactor({ state, audioLevel, size = 220 }: ArcReactorProps) {
  const colors = STATE_COLORS[state];
  const pulse = state === "listening" ? 0.4 + audioLevel * 0.6 : state === "speaking" ? 0.5 + audioLevel * 0.5 : 0.6;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`JARVIS core — ${colors.label}`}
    >
      {/* outer glow */}
      <div
        className="absolute inset-0 rounded-full blur-2xl transition-all duration-500"
        style={{ background: colors.glow, opacity: pulse, transform: `scale(${1 + audioLevel * 0.12})` }}
      />

      {/* outer rotating ring with ticks */}
      <svg
        viewBox="0 0 200 200"
        className="absolute inset-0 anim-spin-slow"
        style={{ filter: `drop-shadow(0 0 6px ${colors.glow})` }}
      >
        <defs>
          <linearGradient id="arco-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors.ring} stopOpacity="0.9" />
            <stop offset="50%" stopColor={colors.ring} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colors.ring} stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="94" fill="none" stroke={colors.ring} strokeOpacity="0.25" strokeWidth="1" />
        {/* tick marks */}
        {Array.from({ length: 60 }).map((_, i) => {
          const angle = (i / 60) * Math.PI * 2;
          const r1 = 88;
          const r2 = i % 5 === 0 ? 80 : 84;
          const x1 = 100 + Math.cos(angle) * r1;
          const y1 = 100 + Math.sin(angle) * r1;
          const x2 = 100 + Math.cos(angle) * r2;
          const y2 = 100 + Math.sin(angle) * r2;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={colors.ring}
              strokeOpacity={i % 5 === 0 ? 0.7 : 0.3}
              strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
            />
          );
        })}
      </svg>

      {/* middle counter-rotating ring with arcs */}
      <svg viewBox="0 0 200 200" className="absolute anim-spin-slow-rev" style={{ width: size * 0.78, height: size * 0.78 }}>
        <circle cx="100" cy="100" r="70" fill="none" stroke="url(#arco-grad)" strokeWidth="2" strokeDasharray="40 18 22 120" strokeLinecap="round" />
        <circle cx="100" cy="100" r="62" fill="none" stroke={colors.ring} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 6" />
      </svg>

      {/* inner fast ring */}
      <svg viewBox="0 0 200 200" className="absolute anim-spin-med" style={{ width: size * 0.6, height: size * 0.6 }}>
        <circle cx="100" cy="100" r="50" fill="none" stroke={colors.ring} strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="90 60" strokeLinecap="round" />
      </svg>

      {/* core */}
      <motion.div
        className="relative flex flex-col items-center justify-center rounded-full"
        style={{
          width: size * 0.42,
          height: size * 0.42,
          background: `radial-gradient(circle, ${colors.ring} 0%, ${colors.ring}33 60%, transparent 100%)`,
          boxShadow: `0 0 30px ${colors.glow}, inset 0 0 20px ${colors.ring}66`,
        }}
        animate={{
          scale: state === "listening" || state === "speaking" ? [1, 1 + audioLevel * 0.25, 1] : [1, 1.05, 1],
          opacity: [0.85, 1, 0.85],
        }}
        transition={{
          duration: state === "listening" || state === "speaking" ? 0.5 : 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div
          className="rounded-full"
          style={{
            width: "55%",
            height: "55%",
            background: colors.ring,
            boxShadow: `0 0 24px ${colors.ring}, 0 0 48px ${colors.glow}`,
          }}
        />
      </motion.div>

      {/* status label */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span
          className="font-mono text-[11px] tracking-[0.35em] anim-blink"
          style={{ color: colors.ring, textShadow: `0 0 8px ${colors.glow}` }}
        >
          {colors.label}
        </span>
      </div>
    </div>
  );
}
