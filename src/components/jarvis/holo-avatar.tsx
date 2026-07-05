// ============================================================
// 3D Holographic Avatar — Pure CSS + Canvas animated sphere
// Lightweight alternative/complement to the SVG ArcReactor.
// No Three.js — uses Canvas wireframe + CSS glow animations.
// ============================================================

import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import type { JarvisState } from "@/lib/jarvis-store";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

interface HoloAvatarProps {
  state: JarvisState;
  size?: number;
  className?: string;
}

/* ─── State color map (hex for Canvas compatibility) ─── */
const STATE_COLORS: Record<JarvisState, { primary: string; glow: string; ring: string }> = {
  idle:      { primary: "#00d4ff", glow: "rgba(0, 212, 255, 0.3)",  ring: "rgba(0, 212, 255, 0.15)" },
  listening: { primary: "#00ff88", glow: "rgba(0, 255, 136, 0.4)",  ring: "rgba(0, 255, 136, 0.2)" },
  thinking:  { primary: "#ff9500", glow: "rgba(255, 149, 0, 0.3)",  ring: "rgba(255, 149, 0, 0.15)" },
  speaking:  { primary: "#00d4ff", glow: "rgba(0, 212, 255, 0.5)",  ring: "rgba(0, 212, 255, 0.25)" },
  error:     { primary: "#ff2d2d", glow: "rgba(255, 45, 45, 0.3)",  ring: "rgba(255, 45, 45, 0.15)" },
};

const STATE_LABELS: Record<JarvisState, string> = {
  idle: "STANDBY",
  listening: "LISTENING",
  thinking: "PROCESSING",
  speaking: "SPEAKING",
  error: "ERROR",
};

/* ─── Component ─── */
export function HoloAvatar({ state, size = 200, className = "" }: HoloAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const colors = STATE_COLORS[state];
  const label = STATE_LABELS[state];

  // Pre-compute dot distribution on sphere surface (Fibonacci sphere)
  const dotSeeds = useMemo(() => {
    const seeds: { phi: number; theta: number }[] = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 80; i++) {
      const y = 1 - (i / 80) * 2;           // -1..1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = Math.acos(y);
      const phi = goldenAngle * i;
      seeds.push({ phi, theta });
    }
    return seeds;
  }, []);

  // Canvas-based wireframe sphere with rotating rings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const c = ctx; // narrowed alias for closure

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    c.scale(dpr, dpr);

    let animId: number;
    let angle = 0;

    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.35;

    function drawFrame() {
      c.clearRect(0, 0, size, size);
      const color = STATE_COLORS[state].primary;

      // ── 1. Outer glow sphere (radial gradient) ──
      const outerGlow = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.1);
      outerGlow.addColorStop(0, color);
      outerGlow.addColorStop(0.5, STATE_COLORS[state].glow);
      outerGlow.addColorStop(1, "transparent");
      c.globalAlpha = state === "thinking" ? 0.12 : state === "speaking" ? 0.08 : 0.04;
      c.fillStyle = outerGlow;
      c.beginPath();
      c.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
      c.fill();

      // ── 2. Rotating wireframe rings (3 ellipses at different tilt angles) ──
      for (let ring = 0; ring < 3; ring++) {
        const ringAngle = angle + (ring * Math.PI * 2) / 3;
        const ringR = r * (0.85 + ring * 0.12);
        const tiltFactor = 0.25 + Math.abs(Math.sin(ringAngle * 0.5)) * 0.35;

        c.save();
        c.translate(cx, cy);
        c.rotate(ringAngle * 0.3);
        c.scale(1, tiltFactor);
        c.beginPath();
        c.arc(0, 0, ringR, 0, Math.PI * 2);
        c.strokeStyle = color;
        c.globalAlpha = 0.12 + ring * 0.08;
        c.lineWidth = 1.2;
        c.stroke();
        c.restore();
      }

      // ── 3. Latitude lines (horizontal circles at different heights) ──
      const latitudes = [-0.6, -0.3, 0, 0.3, 0.6];
      for (const lat of latitudes) {
        const latR = r * 0.92 * Math.cos(lat * (Math.PI / 2));
        const latY = cy + r * 0.92 * Math.sin(lat * (Math.PI / 2));
        const latTilt = Math.cos(lat * (Math.PI / 2)); // 0 at poles, 1 at equator

        c.save();
        c.translate(cx, latY - cy + cy);
        c.scale(1, latTilt * 0.3);
        c.beginPath();
        c.arc(cx, cy, latR, 0, Math.PI * 2);
        c.strokeStyle = color;
        c.globalAlpha = 0.06;
        c.lineWidth = 0.6;
        c.stroke();
        c.restore();
      }

      // ── 4. Wireframe dots on the sphere surface (Fibonacci distribution) ──
      const dotCount = state === "thinking" ? 65 : state === "speaking" ? 50 : 35;
      const speed = state === "thinking" ? 0.035 : state === "speaking" ? 0.022 : 0.008;

      for (let i = 0; i < Math.min(dotCount, dotSeeds.length); i++) {
        const { phi, theta } = dotSeeds[i];
        const rotPhi = phi + angle;

        const x3d = Math.sin(theta) * Math.cos(rotPhi);
        const y3d = Math.cos(theta);
        const z3d = Math.sin(theta) * Math.sin(rotPhi);

        // Simple perspective projection
        const perspective = 2.5;
        const scale = perspective / (perspective + z3d);

        const x = cx + x3d * r * 0.9 * scale;
        const y = cy + y3d * r * 0.9 * scale * 0.65; // squish for pseudo-3D

        const depth = (z3d + 1) / 2; // 0 (back) .. 1 (front)
        const dotSize = (0.8 + depth * 2) * scale;

        // Only draw dots facing forward (z > -0.2)
        if (z3d > -0.2) {
          c.beginPath();
          c.arc(x, y, dotSize, 0, Math.PI * 2);
          c.fillStyle = color;
          c.globalAlpha = 0.08 + depth * 0.55;
          c.fill();
        }
      }

      // ── 5. Center bright glow core ──
      const coreGlow = c.createRadialGradient(cx, cy, 0, cx, cy, r * 0.4);
      coreGlow.addColorStop(0, color);
      coreGlow.addColorStop(0.4, STATE_COLORS[state].glow);
      coreGlow.addColorStop(1, "transparent");
      c.globalAlpha = state === "thinking" ? 0.2 : state === "speaking" ? 0.14 : 0.07;
      c.fillStyle = coreGlow;
      c.beginPath();
      c.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      c.fill();

      // ── 6. Speaking state: audio wave rings ──
      if (state === "speaking") {
        const waveCount = 3;
        for (let w = 0; w < waveCount; w++) {
          const wavePhase = (angle * 3 + w * (Math.PI * 2 / waveCount)) % (Math.PI * 2);
          const waveR = r * (0.5 + (wavePhase / (Math.PI * 2)) * 0.6);
          const waveAlpha = 0.15 * (1 - wavePhase / (Math.PI * 2));

          c.beginPath();
          c.arc(cx, cy, waveR, 0, Math.PI * 2);
          c.strokeStyle = color;
          c.globalAlpha = Math.max(0, waveAlpha);
          c.lineWidth = 1;
          c.stroke();
        }
      }

      // ── 7. Error state: glitch lines ──
      if (state === "error") {
        const glitchLines = 5;
        for (let g = 0; g < glitchLines; g++) {
          const gy = cy + (Math.sin(angle * 5 + g * 1.7) * r * 0.6);
          const gw = r * 0.3 + Math.random() * r * 0.4;
          const gx = cx - gw / 2 + Math.sin(angle * 3 + g) * 10;

          c.fillStyle = color;
          c.globalAlpha = 0.1 + Math.random() * 0.15;
          c.fillRect(gx, gy, gw, 1);
        }
      }

      c.globalAlpha = 1;
      angle += reduced ? 0 : speed;
      animId = requestAnimationFrame(drawFrame);
    }

    drawFrame();
    return () => cancelAnimationFrame(animId);
  }, [state, size, reduced, dotSeeds]);

  // Animation variants for outer glow
  const glowPulse = reduced
    ? { scale: 1, opacity: 0.7 }
    : state === "thinking"
      ? { scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }
      : state === "speaking"
        ? { scale: [1, 1.12, 0.95, 1.08, 1], opacity: [0.5, 0.9, 0.5, 0.85, 0.5] }
        : state === "listening"
          ? { scale: [1, 1.1, 1], opacity: [0.5, 0.85, 0.5] }
          : { scale: [1, 1.04, 1], opacity: [0.4, 0.75, 0.4] };

  const glowDuration = state === "thinking" ? 1.2 : state === "speaking" ? 1.8 : state === "listening" ? 0.8 : 3;

  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`}
      style={{ width: size, height: size + 28 }}
      aria-label={`Holographic avatar — ${label}`}
    >
      {/* ── Outer glow (CSS blur + framer-motion) ── */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: size * 0.82,
          height: size * 0.82,
          top: `calc(50% - ${(size * 0.82) / 2}px - 14px)`,
          left: `calc(50% - ${(size * 0.82) / 2}px)`,
          background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
          filter: "blur(24px)",
        }}
        animate={glowPulse}
        transition={reduced ? { duration: 0 } : {
          duration: glowDuration,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* ── Rotating CSS ring borders ── */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: size * 0.72,
          height: size * 0.72,
          top: `calc(50% - ${(size * 0.72) / 2}px - 14px)`,
          left: `calc(50% - ${(size * 0.72) / 2}px)`,
          perspective: "600px",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Ring 1 — horizontal rotation */}
        <motion.div
          className="absolute inset-0 rounded-full border"
          style={{ borderColor: colors.ring, borderWidth: "0.8px" }}
          animate={reduced ? {} : { rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
        {/* Ring 2 — tilted X axis */}
        <motion.div
          className="absolute inset-2 rounded-full border"
          style={{
            borderColor: colors.ring,
            borderWidth: "0.6px",
            transform: "rotateX(60deg)",
          }}
          animate={reduced ? {} : { rotate: -360 }}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        />
        {/* Ring 3 — tilted Y axis */}
        <motion.div
          className="absolute inset-4 rounded-full border"
          style={{
            borderColor: colors.ring,
            borderWidth: "0.5px",
            transform: "rotateY(60deg)",
          }}
          animate={reduced ? {} : { rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* ── Canvas sphere ── */}
      <canvas
        ref={canvasRef}
        className="relative z-[1]"
        style={{ width: size, height: size }}
      />

      {/* ── State label ── */}
      <motion.div
        className="relative z-[1] font-mono text-[9px] uppercase tracking-[0.3em] mt-1"
        style={{ color: colors.primary, textShadow: `0 0 8px ${colors.glow}` }}
        animate={reduced ? { opacity: 0.8 } : { opacity: [0.35, 1, 0.35] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        {label}
      </motion.div>
    </div>
  );
}