"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import type { JarvisState } from "@/hooks/use-jarvis";

interface ArcReactorProps {
  state: JarvisState;
  audioLevel: number; // 0..1
  size?: number;
}

/* ─── State color map ─── */
const STATE_COLORS: Record<JarvisState, { ring: string; glow: string; label: string }> = {
  idle:      { ring: "oklch(0.82 0.17 193)", glow: "oklch(0.82 0.17 193 / 45%)",  label: "ONLINE" },
  listening: { ring: "oklch(0.78 0.16 165)", glow: "oklch(0.78 0.16 165 / 55%)",  label: "LISTENING" },
  thinking:  { ring: "oklch(0.82 0.14 80)",  glow: "oklch(0.82 0.14 80 / 55%)",   label: "PROCESSING" },
  speaking:  { ring: "oklch(0.80 0.16 220)", glow: "oklch(0.80 0.16 220 / 55%)",  label: "SPEAKING" },
  error:     { ring: "oklch(0.65 0.22 22)",  glow: "oklch(0.65 0.22 22 / 55%)",   label: "ERROR" },
};

/* ─── Speed multiplier per state (thinking = fast boost) ─── */
const SPEED: Record<JarvisState, number> = {
  idle: 1, listening: 1.3, thinking: 2.2, speaking: 1, error: 1.5,
};

/* ─── Pre-computed static geometry (viewBox 200×200, centre 100,100) ─── */

const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
  const long = i % 5 === 0;
  const r1 = 97, r2 = long ? 86 : 91;
  return {
    x1: 100 + Math.cos(a) * r1, y1: 100 + Math.sin(a) * r1,
    x2: 100 + Math.cos(a) * r2, y2: 100 + Math.sin(a) * r2,
    op: long ? 0.8 : 0.3, w: long ? 1.4 : 0.6,
  };
});

const TRIANGLES = Array.from({ length: 6 }, (_, i) => {
  const a = (i * 60) * Math.PI / 180 - Math.PI / 2;
  const r = 83, s = 5.5;
  const perp = a + Math.PI / 2;
  const bx = 100 + Math.cos(a) * r, by = 100 + Math.sin(a) * r;
  const tx = 100 + Math.cos(a) * (r + s), ty = 100 + Math.sin(a) * (r + s);
  return `${tx},${ty} ${bx + Math.cos(perp) * s * 0.45},${by + Math.sin(perp) * s * 0.45} ${bx - Math.cos(perp) * s * 0.45},${by - Math.sin(perp) * s * 0.45}`;
});

const DOTS = Array.from({ length: 45 }, (_, i) => {
  const a = (i * 8) * Math.PI / 180;
  return { cx: 100 + Math.cos(a) * 64, cy: 100 + Math.sin(a) * 64 };
});

const ARCS = Array.from({ length: 3 }, (_, i) => {
  const seg = 80, gap = 40, r = 52;
  const s = (i * (seg + gap) - 90) * Math.PI / 180;
  const e = (s + seg * Math.PI / 180);
  return {
    x1: 100 + Math.cos(s) * r, y1: 100 + Math.sin(s) * r,
    x2: 100 + Math.cos(e) * r, y2: 100 + Math.sin(e) * r, r, la: 0,
  };
});

const TENDRILS = [0, 120, 240].map((deg) => {
  const a = deg * Math.PI / 180 - Math.PI / 2;
  return {
    x1: 100 + Math.cos(a) * 22, y1: 100 + Math.sin(a) * 22,
    x2: 100 + Math.cos(a) * 38, y2: 100 + Math.sin(a) * 38,
  };
});

const NODES = Array.from({ length: 8 }, (_, i) => {
  const a = (i * 45) * Math.PI / 180;
  return { cx: 100 + Math.cos(a) * 20, cy: 100 + Math.sin(a) * 20, i };
});

/* ─── NEW: Hex grid geometry inside core ─── */
const HEX_GRID: { x: number; y: number; r: number; a: number }[] = [];
{
  const hexR = 3;
  const hexW = hexR * Math.sqrt(3);
  const hexH = hexR * 2;
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const x = 100 + col * hexW + (row % 2 !== 0 ? hexW / 2 : 0);
      const y = 100 + row * hexH * 0.75;
      const dist = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2);
      if (dist < 16) {
        HEX_GRID.push({ x, y, r: hexR, a: Math.max(0.03, 0.12 - dist * 0.006) });
      }
    }
  }
}

/* ─── NEW: Emission particles (for speaking state) ─── */
const EMISSION_ANGLES = Array.from({ length: 16 }, (_, i) => ({
  angle: (i / 16) * Math.PI * 2,
  delay: i * 0.15,
}));

/* ─── Component ─── */
export function ArcReactor({ state, audioLevel, size = 220 }: ArcReactorProps) {
  const c = STATE_COLORS[state];
  const sp = SPEED[state];
  const corePx = size * 0.45;

  const isThinking = state === "thinking";
  const isSpeaking = state === "speaking";

  /* State-specific core pulse */
  const pulseDur = state === "listening" ? 0.4 : state === "thinking" ? 0.6 : state === "speaking" ? 1.2 : 2.4;
  const pulseScale = state === "listening"
    ? [1, 1 + audioLevel * 0.3, 1]
    : state === "thinking"
      ? [1, 1.15, 1]
      : state === "speaking"
        ? [1, 1 + audioLevel * 0.18, 1]
        : [1, 1.06, 1];

  /* Animation strings (CSS keyframes already in globals.css) */
  const a1 = `jarvis-spin-slow ${18 / sp}s linear infinite`;     // ring1 CW
  const a2 = `jarvis-spin-reverse ${14 / sp}s linear infinite`;   // ring2 CCW
  const a3 = `jarvis-spin-slow ${10 / sp}s linear infinite`;      // ring3 CW
  const a4 = `jarvis-spin-reverse ${8 / sp}s linear infinite`;    // ring4 CCW
  const a5 = `jarvis-spin-slow ${6 / sp}s linear infinite`;       // ring5 CW
  // NEW rings
  const a6 = `jarvis-spin-reverse ${20 / sp}s linear infinite`;   // ring6 CCW (outer dash)
  const a7 = `jarvis-spin-slow ${12 / sp}s linear infinite`;      // ring7 CW (inner dots)
  const aPulse = `jarvis-pulse-glow ${2.6 / sp}s ease-in-out infinite`;

  const origin = "100px 100px";

  /* Emission particles for speaking state */
  const emissionParticles = useMemo(() => {
    if (!isSpeaking) return null;
    return EMISSION_ANGLES.map((p) => {
      const r1 = 28;
      const r2 = 55;
      return {
        x1: 100 + Math.cos(p.angle) * r1,
        y1: 100 + Math.sin(p.angle) * r1,
        x2: 100 + Math.cos(p.angle) * r2,
        y2: 100 + Math.sin(p.angle) * r2,
        delay: p.delay,
      };
    });
  }, [isSpeaking]);

  return (
    <div
      className="relative flex items-center justify-center jarvis-hologram"
      style={{ width: size, height: size + 40 }}
      aria-label={`JARVIS core — ${c.label}`}
    >
      {/* ── 0. Outer glow halo (brighter during thinking) ── */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 1.35,
          height: size * 1.35,
          top: `calc(50% - ${(size * 1.35) / 2}px)`,
          left: `calc(50% - ${(size * 1.35) / 2}px)`,
          background: `radial-gradient(circle, ${c.glow} 0%, ${c.glow.replace(" / 45%", " / 12%").replace(" / 55%", " / 18%")} 45%, transparent 72%)`,
        }}
        animate={{
          scale: isThinking ? [1, 1.08, 1] : [1, 1.02, 1],
          opacity: isThinking ? [0.85, 1, 0.85] : [0.55, 1, 0.55],
        }}
        transition={{
          duration: isThinking ? 1.2 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ── Main SVG (all rings, geometry, core nodes, tendrils) ── */}
      <svg
        viewBox="0 0 200 200"
        className="absolute top-0 left-0"
        style={{
          width: size,
          height: size,
          filter: `drop-shadow(0 0 ${isThinking ? 12 : 6}px ${c.glow})`,
        }}
      >
        <defs>
          <radialGradient id="ar-core-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={c.ring} stopOpacity="0.18" />
            <stop offset="100%" stopColor={c.ring} stopOpacity="0" />
          </radialGradient>
          {/* Hex grid pattern */}
          <pattern id="hex-grid-pattern" x="0" y="0" width="10.39" height="18" patternUnits="userSpaceOnUse">
            <polygon
              points="5.2,0 10.39,3 10.39,9 5.2,12 0,9 0,3"
              fill="none"
              stroke={c.ring}
              strokeWidth="0.4"
              opacity="0.12"
            />
            <polygon
              points="5.2,6 10.39,9 10.39,15 5.2,18 0,15 0,9"
              fill="none"
              stroke={c.ring}
              strokeWidth="0.4"
              opacity="0.08"
            />
          </pattern>
        </defs>

        {/* ── Ring 1 (outermost): 60 tick marks, CW 18s ── */}
        <g style={{ animation: a1, transformOrigin: origin }}>
          <circle cx="100" cy="100" r="97" fill="none" stroke={c.ring} strokeOpacity="0.12" strokeWidth="0.5" />
          {TICKS.map((t, i) => (
            <line key={`t${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={c.ring} strokeOpacity={t.op} strokeWidth={t.w} />
          ))}
        </g>

        {/* ── NEW Ring 6: Outer segmented dashes, CCW 20s ── */}
        <g style={{ animation: a6, transformOrigin: origin }}>
          <circle cx="100" cy="100" r="92" fill="none"
            stroke={c.ring} strokeOpacity="0.1" strokeWidth="0.4"
            strokeDasharray="3 8 12 5 6 10" strokeLinecap="round" />
        </g>

        {/* ── Ring 2: Segmented arcs + 6 triangular markers, CCW 14s ── */}
        <g style={{ animation: a2, transformOrigin: origin }}>
          <circle cx="100" cy="100" r="76" fill="none"
            stroke={c.ring} strokeOpacity="0.2" strokeWidth="0.5"
            strokeDasharray="30 18 22 12 42 28" strokeLinecap="round" />
          <circle cx="100" cy="100" r="76" fill="none"
            stroke={c.ring} strokeOpacity="0.4" strokeWidth="2.2"
            strokeDasharray="16 28 32 14 10 44" strokeLinecap="round" />
          {TRIANGLES.map((pts, i) => (
            <polygon key={`tri${i}`} points={pts}
              fill={c.ring} fillOpacity="0.08"
              stroke={c.ring} strokeOpacity="0.65" strokeWidth="1" />
          ))}
        </g>

        {/* ── Ring 3: Dotted circle (45 dots every 8°), CW 10s ── */}
        <g style={{ animation: a3, transformOrigin: origin }}>
          <circle cx="100" cy="100" r="64" fill="none" stroke={c.ring} strokeOpacity="0.08" strokeWidth="0.3" />
          {DOTS.map((d, i) => (
            <circle key={`d${i}`} cx={d.cx} cy={d.cy} r="1.1"
              fill={c.ring} fillOpacity="0.5" />
          ))}
        </g>

        {/* ── Ring 4: 3 arc segments, CCW 8s ── */}
        <g style={{ animation: a4, transformOrigin: origin }}>
          <circle cx="100" cy="100" r="52" fill="none" stroke={c.ring} strokeOpacity="0.08" strokeWidth="0.3" />
          {ARCS.map((a) => (
            <path key={`a${a.x1}`}
              d={`M${a.x1} ${a.y1} A${a.r} ${a.r} 0 ${a.la} 1 ${a.x2} ${a.y2}`}
              fill="none" stroke={c.ring} strokeOpacity="0.55" strokeWidth="1.8" strokeLinecap="round" />
          ))}
        </g>

        {/* ── NEW Ring 7: Inner micro-dots ring, CW 12s ── */}
        <g style={{ animation: a7, transformOrigin: origin }}>
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const r = 46;
            return (
              <circle
                key={`id${i}`}
                cx={100 + Math.cos(a) * r}
                cy={100 + Math.sin(a) * r}
                r="0.6"
                fill={c.ring}
                fillOpacity="0.3"
              />
            );
          })}
        </g>

        {/* ── Ring 5 (innermost solid ring): Solid thin ring with pulse, CW 6s ── */}
        <g style={{ animation: `${a5}, ${aPulse}`, transformOrigin: origin }}>
          <circle cx="100" cy="100" r="40" fill="none"
            stroke={c.ring} strokeOpacity="0.15" strokeWidth="4" />
          <circle cx="100" cy="100" r="40" fill="none"
            stroke={c.ring} strokeOpacity="0.45" strokeWidth="0.8" />
        </g>

        {/* ── Energy tendrils: 3 gradient lines from core outward ── */}
        <g>
          {TENDRILS.map((l, i) => (
            <line key={`tn${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
              stroke={c.ring} strokeWidth="0.9" strokeLinecap="round">
              <animate attributeName="stroke-opacity" values="0.6;0.2;0.6" dur="2s"
                repeatCount="indefinite" begin={`${i * 0.67}s`} />
            </line>
          ))}
        </g>

        {/* ── Core background glow ── */}
        <circle cx="100" cy="100" r="28" fill="url(#ar-core-bg)" />

        {/* ── Hex grid pattern inside core ── */}
        <clipPath id="core-clip">
          <circle cx="100" cy="100" r="28" />
        </clipPath>
        <g clipPath="url(#core-clip)">
          <rect x="72" y="72" width="56" height="56" fill="url(#hex-grid-pattern)" />
        </g>

        {/* ── Core outer ring + 8 energy nodes ── */}
        <g>
          <circle cx="100" cy="100" r="20" fill="none"
            stroke={c.ring} strokeOpacity="0.25" strokeWidth="0.7" />
          {NODES.map((n) => (
            <circle key={`n${n.i}`} cx={n.cx} cy={n.cy} r="1.3"
              fill={c.ring} fillOpacity="0.85">
              <animate attributeName="fill-opacity" values="0.35;1;0.35" dur="2s"
                repeatCount="indefinite" begin={`${n.i * 0.25}s`} />
            </circle>
          ))}
        </g>

        {/* ── NEW: Emission particles during speaking state ── */}
        {emissionParticles?.map((p, i) => (
          <circle
            key={`ep${i}`}
            cx={p.x1}
            cy={p.y1}
            r="1.2"
            fill={c.ring}
            fillOpacity="0"
          >
            <animate
              attributeName="cx"
              from={p.x1}
              to={p.x2}
              dur="1.5s"
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="cy"
              from={p.y1}
              to={p.y2}
              dur="1.5s"
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="fill-opacity"
              values="0;0.7;0.3;0"
              dur="1.5s"
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="1.2;0.8;0.4"
              dur="1.5s"
              begin={`${p.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>

      {/* ── Core (Framer Motion) ── */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: corePx,
          height: corePx,
          top: `calc(50% - ${corePx / 2}px)`,
          left: `calc(50% - ${corePx / 2}px)`,
          background: `radial-gradient(circle, ${c.ring} 0%, ${c.ring}33 60%, transparent 100%)`,
          boxShadow: isThinking
            ? `0 0 50px ${c.glow}, 0 0 100px ${c.glow.replace(" / 55%", " / 25%")}, inset 0 0 25px ${c.ring}88`
            : `0 0 30px ${c.glow}, inset 0 0 18px ${c.ring}66`,
        }}
        animate={{
          scale: pulseScale,
          opacity: [0.85, 1, 0.85],
        }}
        transition={{
          duration: pulseDur,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Inner bright circle */}
        <div
          className="absolute rounded-full"
          style={{
            width: "48%",
            height: "48%",
            top: "26%",
            left: "26%",
            background: c.ring,
            boxShadow: isThinking
              ? `0 0 25px ${c.ring}, 0 0 50px ${c.glow}, 0 0 80px ${c.glow}`
              : `0 0 18px ${c.ring}, 0 0 36px ${c.glow}, 0 0 60px ${c.glow}`,
          }}
        />
      </motion.div>

      {/* ── HUD label with annotation lines ── */}
      <div
        className="absolute flex items-center justify-center"
        style={{ bottom: 4, left: "50%", transform: "translateX(-50%)" }}
      >
        {/* Vertical connector line */}
        <div
          className="absolute"
          style={{
            top: -20,
            width: 1,
            height: 18,
            background: c.ring,
            opacity: 0.3,
          }}
        />

        {/* Left annotation line group */}
        <svg width="64" height="14" className="shrink-0" viewBox="0 0 64 14">
          <line x1="0" y1="7" x2="48" y2="7" stroke={c.ring} strokeOpacity="0.35" strokeWidth="0.7" />
          <line x1="48" y1="3" x2="48" y2="11" stroke={c.ring} strokeOpacity="0.35" strokeWidth="0.7" />
          <line x1="48" y1="7" x2="58" y2="7" stroke={c.ring} strokeOpacity="0.5" strokeWidth="0.7" />
          <circle cx="58" cy="7" r="1.5" fill={c.ring} fillOpacity="0.6" />
          <line x1="59.5" y1="7" x2="64" y2="7" stroke={c.ring} strokeOpacity="0.5" strokeWidth="0.7" />
        </svg>

        {/* Label text */}
        <span
          className="font-mono text-[11px] tracking-[0.35em] px-2 anim-blink whitespace-nowrap"
          style={{ color: c.ring, textShadow: `0 0 8px ${c.glow}` }}
        >
          {c.label}
        </span>

        {/* Right annotation line group (mirror) */}
        <svg width="64" height="14" className="shrink-0" viewBox="0 0 64 14">
          <line x1="0" y1="7" x2="5" y2="7" stroke={c.ring} strokeOpacity="0.5" strokeWidth="0.7" />
          <circle cx="6" cy="7" r="1.5" fill={c.ring} fillOpacity="0.6" />
          <line x1="7.5" y1="7" x2="16" y2="7" stroke={c.ring} strokeOpacity="0.5" strokeWidth="0.7" />
          <line x1="16" y1="3" x2="16" y2="11" stroke={c.ring} strokeOpacity="0.35" strokeWidth="0.7" />
          <line x1="16" y1="7" x2="64" y2="7" stroke={c.ring} strokeOpacity="0.35" strokeWidth="0.7" />
        </svg>
      </div>
    </div>
  );
}