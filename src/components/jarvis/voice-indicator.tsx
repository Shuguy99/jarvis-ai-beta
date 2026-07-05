// ============================================================
// Voice Indicator — Canvas-based circular voice visualization
// States: idle (static ring), listening (pulsing cyan waveform),
// processing (spinning blue), speaking (volume-reactive green)
// ============================================================

import { useCallback, useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { VoicePipelineState } from "@/lib/voice-pipeline";

interface VoiceIndicatorProps {
  state: VoicePipelineState;
  volume?: number;
  waveformData?: Uint8Array;
  size?: number;
  className?: string;
}

const COLORS = {
  idle: { r: 22, g: 163, b: 74 },      // muted cyan/gray
  listening: { r: 0, g: 210, b: 235 },  // cyan
  processing: { r: 59, g: 130, b: 246 }, // blue
  speaking: { r: 34, g: 197, b: 94 },    // green
} as const;

function rgba(c: (typeof COLORS)[keyof typeof COLORS], a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

export function VoiceIndicator({
  state,
  volume = 0,
  waveformData,
  size = 120,
  className = "",
}: VoiceIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const reduced = useReducedMotion();
  const rotationRef = useRef(0);
  const pulseRef = useRef(0);
  const prevTimeRef = useRef(performance.now());

  const color = COLORS[state] ?? COLORS.idle;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const dt = (now - prevTimeRef.current) / 1000;
    prevTimeRef.current = now;
    const dpr = window.devicePixelRatio || 1;

    // Set canvas size
    const displaySize = size;
    if (canvas.width !== displaySize * dpr || canvas.height !== displaySize * dpr) {
      canvas.width = displaySize * dpr;
      canvas.height = displaySize * dpr;
      canvas.style.width = `${displaySize}px`;
      canvas.style.height = `${displaySize}px`;
      ctx.scale(dpr, dpr);
    }

    const cx = displaySize / 2;
    const cy = displaySize / 2;
    const baseRadius = displaySize * 0.3;
    const maxBarHeight = displaySize * 0.18;

    ctx.clearRect(0, 0, displaySize, displaySize);

    if (state === "idle") {
      // Static ring with subtle glow
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 0.3);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, 0.5);
      ctx.fill();
    } else if (state === "listening") {
      // Pulsing outer ring
      if (!reduced) {
        pulseRef.current += dt * 2;
      }
      const pulse = 0.5 + Math.sin(pulseRef.current) * 0.3;

      // Outer glow ring
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius + 8 + pulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 0.1 + pulse * 0.1);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 0.5);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Waveform bars around the circle
      const barCount = 32;
      const dataLen = waveformData?.length ?? 0;
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const dataIndex = dataLen > 0
          ? Math.floor((i / barCount) * dataLen)
          : 0;
        const dataValue = dataLen > 0 ? (waveformData?.[dataIndex] ?? 0) / 255 : 0;

        // Mix data-driven height with sine wave for aesthetics
        let barH: number;
        if (reduced) {
          barH = maxBarHeight * 0.3;
        } else {
          const sineH = reduced ? 0 : (0.2 + Math.sin(pulseRef.current * 3 + i * 0.5) * 0.3);
          barH = maxBarHeight * Math.max(0.08, dataValue * 0.7 + sineH);
        }

        const innerR = baseRadius + 4;
        const outerR = innerR + barH;

        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * outerR;
        const y2 = cy + Math.sin(angle) * outerR;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = rgba(color, 0.4 + dataValue * 0.6);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // Center mic icon (simplified)
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, 0.9);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + 3 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();

    } else if (state === "processing") {
      // Spinning ring with dots
      if (!reduced) {
        rotationRef.current += dt * 2.5;
      }
      const rot = rotationRef.current;

      // Outer spinning dashed ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.beginPath();
      const dashCount = 24;
      for (let i = 0; i < dashCount; i++) {
        const angle = (i / dashCount) * Math.PI * 2;
        const len = i % 2 === 0 ? 6 : 3;
        const r1 = baseRadius + 4;
        const r2 = r1 + len;
        const x1 = Math.cos(angle) * r1;
        const y1 = Math.sin(angle) * r1;
        const x2 = Math.cos(angle) * r2;
        const y2 = Math.sin(angle) * r2;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = rgba(color, i % 2 === 0 ? 0.7 : 0.3);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }
      ctx.restore();

      // Inner ring
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius - 2, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 0.2);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Center spinning dots
      for (let i = 0; i < 3; i++) {
        const angle = rot * 1.5 + (i / 3) * Math.PI * 2;
        const dotR = baseRadius * 0.4;
        const dx = cx + Math.cos(angle) * dotR;
        const dy = cy + Math.sin(angle) * dotR;
        ctx.beginPath();
        ctx.arc(dx, dy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = rgba(color, 0.6);
        ctx.fill();
      }

    } else if (state === "speaking") {
      // Volume-reactive ring
      if (!reduced) {
        pulseRef.current += dt * 3;
      }
      const vol = Math.max(0.1, volume);

      // Pulsing outer ring based on volume
      const outerR = baseRadius + 6 + vol * 12;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 0.15 + vol * 0.2);
      ctx.lineWidth = 1 + vol * 2;
      ctx.stroke();

      // Base ring
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(color, 0.5);
      ctx.lineWidth = 2;
      ctx.stroke();

      // Volume-reactive bars
      const barCount = 32;
      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        let barH: number;
        if (reduced) {
          barH = maxBarHeight * 0.3;
        } else {
          const wave = Math.sin(pulseRef.current + i * 0.4) * 0.3;
          barH = maxBarHeight * Math.max(0.05, vol * 0.8 + wave * 0.4);
        }

        const innerR = baseRadius + 3;
        const outerBar = innerR + barH;
        const x1 = cx + Math.cos(angle) * innerR;
        const y1 = cy + Math.sin(angle) * innerR;
        const x2 = cx + Math.cos(angle) * outerBar;
        const y2 = cy + Math.sin(angle) * outerBar;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = rgba(color, 0.3 + vol * 0.7);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      // Center speaker icon (simplified arcs)
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, 0.8);
      ctx.fill();
      // Sound waves
      for (let w = 1; w <= 2; w++) {
        ctx.beginPath();
        ctx.arc(cx, cy, 8 + w * 5, -Math.PI / 4, Math.PI / 4);
        ctx.strokeStyle = rgba(color, 0.3 / w);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    rafRef.current = requestAnimationFrame(draw);
  }, [state, volume, waveformData, size, color, reduced]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: "block",
        width: size,
        height: size,
      }}
    />
  );
}