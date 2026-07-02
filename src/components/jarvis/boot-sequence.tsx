"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sounds";

interface BootSequenceProps {
  onComplete: () => void;
}

const SYSTEM_LINES = [
  { label: "Neural Core", status: "ONLINE" },
  { label: "Language Processing", status: "ONLINE" },
  { label: "Voice Interface", status: "ONLINE" },
  { label: "Threat Assessment", status: "STANDBY" },
  { label: "Secure Channel", status: "ENCRYPTED" },
] as const;

/** Timing constants (ms) */
const T = {
  PHASE1_END: 800,
  PHASE2_LINE_INTERVAL: 150,
  PHASE2_END: 2000,
  PHASE3_END: 2800,
  PHASE4_END: 3500,
} as const;

export function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);
  const [visibleLines, setVisibleLines] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);
  const calledRef = useRef(false);

  const complete = useCallback(() => {
    if (!calledRef.current) {
      calledRef.current = true;
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    // --- Phase 1: power-up sound ---
    playSound("power-up");
    // --- Phase 1 → 2 transition ---
    const t1 = setTimeout(() => setPhase(2), T.PHASE1_END);

    return () => {
      clearTimeout(t1);
    };
  }, []);

  // Phase 2: stagger system lines and progress bar
  useEffect(() => {
    if (phase !== 2) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Stagger each system line appearing
    SYSTEM_LINES.forEach((_, i) => {
      timers.push(
        setTimeout(() => {
          setVisibleLines(i + 1);
        }, i * T.PHASE2_LINE_INTERVAL)
      );
    });

    // Progress bar: animate from 0 → 100 across phase 2 duration
    const progressStart = Date.now();
    const progressDuration = T.PHASE2_END - T.PHASE1_END;
    let rafId: number;

    const tick = () => {
      const elapsed = Date.now() - progressStart;
      const pct = Math.min((elapsed / progressDuration) * 100, 100);
      setProgressWidth(pct);
      if (pct < 100) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);

    // --- Phase 2 → 3 transition ---
    timers.push(setTimeout(() => setPhase(3), T.PHASE2_END - T.PHASE1_END));

    return () => {
      timers.forEach(clearTimeout);
      cancelAnimationFrame(rafId);
    };
  }, [phase]);

  // Phase 3 → 4 → complete
  useEffect(() => {
    if (phase !== 3) return;
    playSound("boot-sequence");
    const t3 = setTimeout(() => setPhase(4), T.PHASE3_END - T.PHASE2_END);
    const t4 = setTimeout(() => { playSound("activate"); complete(); }, T.PHASE4_END - T.PHASE2_END);

    return () => {
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [phase, complete]);

  // Safety: if component unmounts before complete is called
  useEffect(() => {
    const safety = setTimeout(() => complete(), T.PHASE4_END + 500);
    return () => clearTimeout(safety);
  }, [complete]);

  return (
    <AnimatePresence>
      {phase < 4 && (
        <motion.div
          key="boot-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background"
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {/* ===== PHASE 1: INITIALIZING ===== */}
          <AnimatePresence mode="wait">
            {phase === 1 && (
              <motion.div
                key="phase1"
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.4 }}
                transition={{ duration: 0.6 }}
              >
                {/* Central pulsing dot */}
                <motion.div
                  className="h-2 w-2 rounded-full bg-primary"
                  animate={{
                    scale: [1, 1.8, 1],
                    opacity: [0.5, 1, 0.5],
                    boxShadow: [
                      "0 0 4px oklch(0.85 0.19 193 / 30%)",
                      "0 0 20px oklch(0.85 0.19 193 / 80%), 0 0 40px oklch(0.85 0.19 193 / 40%)",
                      "0 0 4px oklch(0.85 0.19 193 / 30%)",
                    ],
                  }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* STARK INDUSTRIES */}
                <motion.p
                  className="font-mono text-[11px] tracking-[0.3em] text-primary/60 uppercase"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                >
                  STARK INDUSTRIES
                </motion.p>

                {/* J.A.R.V.I.S. PROTOCOL */}
                <motion.h1
                  className="font-mono text-sm tracking-[0.25em] text-primary uppercase jarvis-glow"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.5 }}
                >
                  J.A.R.V.I.S. PROTOCOL
                </motion.h1>
              </motion.div>
            )}

            {/* ===== PHASE 2: SYSTEMS CHECK ===== */}
            {phase === 2 && (
              <motion.div
                key="phase2"
                className="flex w-full max-w-md flex-col items-center gap-5 px-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0.3 }}
                transition={{ duration: 0.4 }}
              >
                {/* Header */}
                <motion.p
                  className="font-mono text-[11px] tracking-[0.3em] text-primary/60 uppercase"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  SYSTEMS CHECK
                </motion.p>

                {/* System lines */}
                <div className="flex w-full flex-col gap-2">
                  {SYSTEM_LINES.map((line, i) => {
                    const isVisible = i < visibleLines;
                    return (
                      <motion.div
                        key={i}
                        className="font-mono text-xs tracking-[0.15em] uppercase"
                        initial={{ opacity: 0, x: -8 }}
                        animate={
                          isVisible
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0, x: -8 }
                        }
                        transition={{ duration: 0.15 }}
                      >
                        <span
                          className={
                            isVisible
                              ? "text-primary jarvis-text-terminal"
                              : "text-primary/20"
                          }
                        >
                          ▸ {line.label.padEnd(22, ".")} {line.status}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="mt-2 w-full">
                  <div className="h-0.5 w-full overflow-hidden rounded-full bg-primary/10">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${progressWidth}%` }}
                      transition={{ ease: "linear" }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* ===== PHASE 3: ACTIVATION ===== */}
            {phase === 3 && (
              <motion.div
                key="phase3"
                className="flex flex-col items-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.35 }}
              >
                {/* Arc reactor flash */}
                <motion.div
                  className="relative flex items-center justify-center"
                  initial={{ scale: 0.2, opacity: 0 }}
                  animate={{ scale: [0.2, 1.5, 1], opacity: [0, 1, 0.8] }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                >
                  {/* Outer glow ring */}
                  <motion.div
                    className="absolute h-24 w-24 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, oklch(0.85 0.19 193 / 60%) 0%, oklch(0.85 0.19 193 / 20%) 40%, transparent 70%)",
                    }}
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [0.8, 1, 0.6],
                    }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Core dot */}
                  <motion.div
                    className="relative h-3 w-3 rounded-full bg-primary"
                    style={{
                      boxShadow:
                        "0 0 12px oklch(0.85 0.19 193 / 90%), 0 0 30px oklch(0.85 0.19 193 / 60%), 0 0 60px oklch(0.85 0.19 193 / 30%)",
                    }}
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.9, 1, 0.9],
                    }}
                    transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.div>

                {/* ALL SYSTEMS OPERATIONAL */}
                <motion.p
                  className="font-mono text-sm tracking-[0.2em] text-primary uppercase jarvis-glow-strong"
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.25, duration: 0.5 }}
                >
                  ALL SYSTEMS OPERATIONAL
                </motion.p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}