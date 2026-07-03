"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Network, ArrowDown, ArrowUp, Wifi, Cable } from "lucide-react";
import { playSound } from "@/lib/sounds";
import { useSystemData } from "@/hooks/use-system-poller";

// ── Types ─────────────────────────────────────────────────────
interface DataPoint {
  download: number;
  upload: number;
}

// ── Helpers ───────────────────────────────────────────────────
const MAX_POINTS = 30;

function formatSpeed(mbps: number): string {
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} Гб/с`;
  if (mbps >= 1) return `${mbps.toFixed(1)} Мб/с`;
  return `${(mbps * 1000).toFixed(0)} Кб/с`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} ГБ`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} МБ`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(1)} КБ`;
  return `${bytes} Б`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Build an SVG polyline "points" string from an array of values */
function toPoints(values: number[], width: number, height: number, padY = 2): string {
  if (values.length === 0) return "";
  const max = Math.max(...values, 0.01);
  const step = width / Math.max(values.length - 1, 1);
  return values
    .map((v, i) => {
      const x = i * step;
      const y = height - padY - (Math.min(v, max) / max) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

// ── Main Component ────────────────────────────────────────────
export function NetworkWidget() {
  const { system } = useSystemData();
  const [history, setHistory] = useState<DataPoint[]>([]);
  const [sessionStart] = useState(() => Date.now());
  const [sessionRx, setSessionRx] = useState(0);
  const [sessionTx, setSessionTx] = useState(0);
  const prevRxRef = useRef<number | null>(null);
  const prevTxRef = useRef<number | null>(null);

  // Update sparkline, session bytes, and sound when system data changes
  useEffect(() => {
    if (!system) return;

    const netSpeedIn = system.netSpeedIn;
    const netSpeedOut = system.netSpeedOut;

    // Accumulate session bytes (approximate from speed × interval)
    // Use speed in Mbps × 5 seconds × 1_000_000 / 8 = bytes
    if (prevRxRef.current !== null) {
      const rxBytes = (netSpeedIn * 5 * 1_000_000) / 8;
      const txBytes = (netSpeedOut * 5 * 1_000_000) / 8;
      setSessionRx((prev) => prev + rxBytes);
      setSessionTx((prev) => prev + txBytes);
    }
    prevRxRef.current = netSpeedIn;
    prevTxRef.current = netSpeedOut;

    // Sparkline history
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory((prev) => {
      const next = [...prev, { download: netSpeedIn, upload: netSpeedOut }];
      return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
    });

    playSound("data-received", 0.2);
  }, [system]);

  // Session timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [sessionStart]);

  // ── Loading state ──────────────────────────────────────────
  if (!system) {
    return (
      <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Network Traffic
            </span>
          </div>
          <div className="flex h-20 items-center justify-center font-mono text-xs text-muted-foreground">
            <span className="anim-pulse-glow">Сканирование сетевого трафика...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Active interface ──────────────────────────────────────
  const activeIface = system.networkInterfaces.find((i) => !i.internal && i.family === "IPv4");
  const ifaceName = activeIface?.name ?? "—";
  const ifaceAddr = activeIface?.address ?? "—";
  const isWifi = /wlan|wi-fi|wifi|wlp/i.test(ifaceName);
  const IfaceIcon = isWifi ? Wifi : Cable;

  // High traffic threshold
  const highTraffic = system.netSpeedIn > 100 || system.netSpeedOut > 100;
  const speedColorIn = highTraffic ? "text-amber-400" : "text-primary";
  const speedColorOut = system.netSpeedOut > 50 ? "text-amber-400" : "text-emerald-400";
  const sparkColorIn = highTraffic ? "#fbbf24" : "currentColor";
  const sparkColorOut = system.netSpeedOut > 50 ? "#fbbf24" : "#34d399";

  // Sparkline data
  const dlValues = history.map((p) => p.download);
  const ulValues = history.map((p) => p.upload);
  const sparkW = 200;
  const sparkH = 32;

  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Network Traffic
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatDuration(elapsed)}
          </span>
        </div>

        {/* Speed readouts */}
        <div className="grid grid-cols-2 gap-3">
          {/* Download */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <ArrowDown className={`h-3 w-3 ${speedColorIn}`} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Загрузка
              </span>
            </div>
            <span className={`font-mono text-base font-bold tabular-nums ${speedColorIn}`}>
              {formatSpeed(system.netSpeedIn)}
            </span>
          </div>
          {/* Upload */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <ArrowUp className={`h-3 w-3 ${speedColorOut}`} />
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Отдача
              </span>
            </div>
            <span className={`font-mono text-base font-bold tabular-nums ${speedColorOut}`}>
              {formatSpeed(system.netSpeedOut)}
            </span>
          </div>
        </div>

        {/* Sparkline charts */}
        {dlValues.length > 1 && (
          <div className="flex flex-col gap-1.5">
            {/* Download sparkline */}
            <div className="relative">
              <svg
                viewBox={`0 0 ${sparkW} ${sparkH}`}
                className="w-full text-primary"
                preserveAspectRatio="none"
                style={{ height: 28 }}
              >
                <polyline
                  points={toPoints(dlValues, sparkW, sparkH)}
                  fill="none"
                  stroke={sparkColorIn}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {/* Upload sparkline */}
            <div className="relative">
              <svg
                viewBox={`0 0 ${sparkW} ${sparkH}`}
                className="w-full text-emerald-400"
                preserveAspectRatio="none"
                style={{ height: 28 }}
              >
                <polyline
                  points={toPoints(ulValues, sparkW, sparkH)}
                  fill="none"
                  stroke={sparkColorOut}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        )}

        {/* Interface info + session totals */}
        <div className="border-t jarvis-border-cyan pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <IfaceIcon className="h-3 w-3" />
              <span className="font-mono text-[10px] truncate max-w-[100px]">
                {ifaceName}
              </span>
              <span className="font-mono text-[10px] text-foreground/60">
                {ifaceAddr}
              </span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>
              ↓ {formatBytes(sessionRx)}
            </span>
            <span>
              ↑ {formatBytes(sessionTx)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}