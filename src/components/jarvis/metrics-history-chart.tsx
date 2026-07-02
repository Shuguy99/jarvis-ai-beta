"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, MemoryStick, Wifi, TrendingUp, TrendingDown, Minus } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────

interface MetricPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  netIn: number;
  netOut: number;
}

// ── Constants ──────────────────────────────────────────────────

const BUFFER_SIZE = 60;
const POLL_INTERVAL = 5000;
const CHART_WIDTH = 600;
const CHART_HEIGHT = 160;
const CHART_PADDING = { top: 4, right: 44, bottom: 4, left: 0 };
const PLOT_W = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const PLOT_H = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

const COLORS = {
  cpu: "oklch(0.85 0.19 193)",
  ram: "#34d399",
  net: "#fbbf24",
} as const;

type MetricKey = "cpu" | "ram" | "net";

// ── Circular Buffer ────────────────────────────────────────────

function createBuffer(): MetricPoint[] {
  return Array.from({ length: BUFFER_SIZE }, () => ({
    timestamp: 0,
    cpu: 0,
    memory: 0,
    netIn: 0,
    netOut: 0,
  }));
}

// ── Catmull-Rom → Cubic Bezier ────────────────────────────────

interface Pt { x: number; y: number }

function catmullRomToBezier(points: Pt[], tension = 0.25): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  const alpha = tension;
  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

    const cp1x = p1.x + (p2.x - p0.x) * alpha;
    const cp1y = p1.y + (p2.y - p0.y) * alpha;
    const cp2x = p2.x - (p3.x - p1.x) * alpha;
    const cp2y = p2.y - (p3.y - p1.y) * alpha;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
}

// ── Build smooth SVG path from data array ─────────────────────

function buildSmoothPath(
  values: number[],
  maxVal: number,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number
): string {
  const step = width / Math.max(1, values.length - 1);
  const pts: Pt[] = values.map((v, i) => ({
    x: offsetX + i * step,
    y: offsetY + height - (v / maxVal) * height,
  }));
  return catmullRomToBezier(pts);
}

// ── Build area path (closed) for gradient fill ────────────────

function buildAreaPath(
  linePath: string,
  offsetX: number,
  bottomY: number,
  values: number[],
  width: number
): string {
  const step = width / Math.max(1, values.length - 1);
  const lastX = offsetX + (values.length - 1) * step;
  return `${linePath} L ${lastX},${bottomY} L ${offsetX},${bottomY} Z`;
}

// ── Stats helpers ──────────────────────────────────────────────

function computeStats(values: number[]) {
  const nonZero = values.filter((v) => v > 0);
  if (nonZero.length === 0) return { min: 0, max: 0, avg: 0 };
  const sum = nonZero.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...nonZero),
    max: Math.max(...nonZero),
    avg: sum / nonZero.length,
  };
}

// ── Toggle Button ──────────────────────────────────────────────

function ToggleBtn({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider transition-all duration-200"
      style={{
        borderColor: active ? color : "transparent",
        color: active ? color : "oklch(0.55 0.03 195)",
        background: active ? `${color}10` : "transparent",
        boxShadow: active ? `0 0 8px ${color}25` : "none",
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: active ? color : "oklch(0.3 0.02 195)",
          boxShadow: active ? `0 0 4px ${color}` : "none",
        }}
      />
      {label}
    </button>
  );
}

// ── Trend Arrow (declared outside render) ──────────────────────

function TrendArrow({ current, prev }: { current: number; prev: number | undefined }) {
  if (prev === undefined || prev === 0) return <Minus className="h-2.5 w-2.5 text-muted-foreground/50" />;
  const diff = current - prev;
  if (Math.abs(diff) < 0.5) return <Minus className="h-2.5 w-2.5 text-muted-foreground/50" />;
  return diff > 0 ? (
    <TrendingUp className="h-2.5 w-2.5" style={{ color: "oklch(0.65 0.22 22)" }} />
  ) : (
    <TrendingDown className="h-2.5 w-2.5" style={{ color: "oklch(0.75 0.15 165)" }} />
  );
}

// ── Metric Chart (declared outside render) ─────────────────────

function MetricChart({
  values,
  maxVal,
  color,
  visible,
}: {
  values: number[];
  maxVal: number;
  color: string;
  visible: boolean;
}) {
  const linePath = buildSmoothPath(
    values,
    maxVal,
    CHART_PADDING.left,
    CHART_PADDING.top,
    PLOT_W,
    PLOT_H
  );
  const areaPath = buildAreaPath(
    linePath,
    CHART_PADDING.left,
    CHART_PADDING.top + PLOT_H,
    values,
    PLOT_W
  );
  const lastVal = values[values.length - 1];
  const lastY =
    CHART_PADDING.top +
    PLOT_H -
    (lastVal / maxVal) * PLOT_H;

  const gradientId = `grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <g>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color}60)` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.4 }}
      />
      {/* Current value dot */}
      {visible && (
        <motion.circle
          cx={CHART_PADDING.left + PLOT_W}
          cy={lastY}
          r="3"
          fill={color}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      )}
      {/* Current value label */}
      <motion.text
        x={CHART_WIDTH - CHART_PADDING.right + 4}
        y={lastY + 3}
        fill={color}
        fontSize="8"
        fontFamily="monospace"
        fontWeight="600"
        initial={{ opacity: 0 }}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {Math.round(lastVal)}
        {maxVal === 100 ? "%" : ""}
      </motion.text>
    </g>
  );
}

// ── Main Component ─────────────────────────────────────────────

export default function MetricsHistoryChart() {
  const bufferRef = useRef<MetricPoint[]>(createBuffer());
  const writeIndexRef = useRef(0);
  const [data, setData] = useState<MetricPoint[]>(createBuffer());
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [showMetrics, setShowMetrics] = useState<Record<MetricKey, boolean>>({
    cpu: true,
    ram: true,
    net: true,
  });

  // ── Polling ───────────────────────────────────────────────
  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/jarvis/system", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (!active) return;

        const buf = bufferRef.current;
        const idx = writeIndexRef.current;
        buf[idx] = {
          timestamp: Date.now(),
          cpu: json.cpuLoad ?? 0,
          memory: json.memPct ?? 0,
          netIn: json.netSpeedIn ?? 0,
          netOut: json.netSpeedOut ?? 0,
        };
        writeIndexRef.current = (idx + 1) % BUFFER_SIZE;
        setData([...buf.slice(writeIndexRef.current), ...buf.slice(0, writeIndexRef.current)]);
      } catch {
        /* ignore fetch errors */
      }
    };

    void poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // ── Derive values from state data ─────────────────────────
  const cpuValues = data.map((d) => d.cpu);
  const ramValues = data.map((d) => d.memory);
  const netValues = data.map((d) => d.netIn + d.netOut);

  // Auto-scale network to a nice round number
  const rawNetMax = Math.max(100, ...netValues);
  const netMax = Math.ceil(rawNetMax / 50) * 50 || 100;

  // ── Hover handling ────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = CHART_WIDTH / rect.width;
      const mouseX = (e.clientX - rect.left) * scaleX;

      // Clamp to plot area
      const plotStart = CHART_PADDING.left;
      const plotEnd = CHART_PADDING.left + PLOT_W;
      const clampedX = Math.max(plotStart, Math.min(plotEnd, mouseX));

      const fraction = (clampedX - plotStart) / PLOT_W;
      const index = Math.round(fraction * (BUFFER_SIZE - 1));
      setHoverIndex(Math.max(0, Math.min(BUFFER_SIZE - 1, index)));
      setHoverX(clampedX);
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoverIndex(null);
  }, []);

  // ── Compute stats ─────────────────────────────────────────
  const cpuStats = computeStats(cpuValues);
  const ramStats = computeStats(ramValues);
  const netStats = computeStats(netValues);

  // Current and previous for arrow indicators
  const currentCpu = cpuValues[BUFFER_SIZE - 1];
  const prevCpu = cpuValues[BUFFER_SIZE - 2];
  const currentRam = ramValues[BUFFER_SIZE - 1];
  const prevRam = ramValues[BUFFER_SIZE - 2];
  const currentNet = netValues[BUFFER_SIZE - 1];
  const prevNet = netValues[BUFFER_SIZE - 2];

  // ── Grid lines ────────────────────────────────────────────
  const gridLines = [0, 50, 100].map((pct) => {
    const y = CHART_PADDING.top + PLOT_H - (pct / 100) * PLOT_H;
    return (
      <g key={`grid-${pct}`}>
        <line
          x1={CHART_PADDING.left}
          y1={y}
          x2={CHART_WIDTH - CHART_PADDING.right}
          y2={y}
          stroke="oklch(0.85 0.19 193 / 15%)"
          strokeWidth="0.5"
        />
        <text
          x={CHART_WIDTH - CHART_PADDING.right + 4}
          y={y + 3}
          fill="oklch(0.55 0.03 195)"
          fontSize="7"
          fontFamily="monospace"
        >
          {pct}%
        </text>
      </g>
    );
  });

  // Vertical grid lines (every 12 points = 1 minute)
  const verticalGridLines = [0, 12, 24, 36, 48].map((i) => {
    const x = CHART_PADDING.left + (i / (BUFFER_SIZE - 1)) * PLOT_W;
    return (
      <line
        key={`vgrid-${i}`}
        x1={x}
        y1={CHART_PADDING.top}
        x2={x}
        y2={CHART_PADDING.top + PLOT_H}
        stroke="oklch(0.85 0.19 193 / 8%)"
        strokeWidth="0.5"
        strokeDasharray="2,4"
      />
    );
  });

  // ── Tooltip data for hovered point ────────────────────────
  const hoveredData = hoverIndex !== null ? data[hoverIndex] : null;

  // ── Render ────────────────────────────────────────────────
  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />

      {/* Title bar */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            System Metrics History
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <ToggleBtn
              label="CPU"
              active={showMetrics.cpu}
              color={COLORS.cpu}
              onClick={() =>
                setShowMetrics((p) => ({ ...p, cpu: !p.cpu }))
              }
            />
            <ToggleBtn
              label="RAM"
              active={showMetrics.ram}
              color={COLORS.ram}
              onClick={() =>
                setShowMetrics((p) => ({ ...p, ram: !p.ram }))
              }
            />
            <ToggleBtn
              label="NET"
              active={showMetrics.net}
              color={COLORS.net}
              onClick={() =>
                setShowMetrics((p) => ({ ...p, net: !p.net }))
              }
            />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/70">
            5m
          </span>
        </div>
      </div>

      {/* SVG Chart */}
      <motion.div
        className="relative w-full cursor-crosshair"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-[160px] w-full"
          preserveAspectRatio="none"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Grid */}
          {gridLines}
          {verticalGridLines}

          {/* CPU chart */}
          <AnimatePresence>
            {showMetrics.cpu && (
              <MetricChart
                values={cpuValues}
                maxVal={100}
                color={COLORS.cpu}
                visible={showMetrics.cpu}
              />
            )}
          </AnimatePresence>

          {/* RAM chart */}
          <AnimatePresence>
            {showMetrics.ram && (
              <MetricChart
                values={ramValues}
                maxVal={100}
                color={COLORS.ram}
                visible={showMetrics.ram}
              />
            )}
          </AnimatePresence>

          {/* Network chart */}
          <AnimatePresence>
            {showMetrics.net && (
              <MetricChart
                values={netValues}
                maxVal={netMax}
                color={COLORS.net}
                visible={showMetrics.net}
              />
            )}
          </AnimatePresence>

          {/* Crosshair on hover */}
          {hoverIndex !== null && (
            <motion.g
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <line
                x1={hoverX}
                y1={CHART_PADDING.top}
                x2={hoverX}
                y2={CHART_PADDING.top + PLOT_H}
                stroke="oklch(0.85 0.19 193 / 50%)"
                strokeWidth="0.8"
                strokeDasharray="3,3"
              />
            </motion.g>
          )}
        </svg>

        {/* Tooltip */}
        <AnimatePresence>
          {hoverIndex !== null && hoveredData && (
            <motion.div
              className="pointer-events-none absolute z-10 flex flex-col gap-1 rounded-md border border-primary/20 bg-card/90 px-2.5 py-2 font-mono text-[10px] backdrop-blur-md"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                left: `${(hoverX / CHART_WIDTH) * 100}%`,
                top: "0",
                transform: "translateX(-50%)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: COLORS.cpu }}
                />
                <span className="text-muted-foreground">CPU</span>
                <span style={{ color: COLORS.cpu }}>
                  {Math.round(hoveredData.cpu)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: COLORS.ram }}
                />
                <span className="text-muted-foreground">RAM</span>
                <span style={{ color: COLORS.ram }}>
                  {Math.round(hoveredData.memory)}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: COLORS.net }}
                />
                <span className="text-muted-foreground">NET</span>
                <span style={{ color: COLORS.net }}>
                  {Math.round(hoveredData.netIn + hoveredData.netOut)} Mbps
                </span>
              </div>
              <div className="mt-0.5 border-t border-primary/10 pt-1 text-[8px] text-muted-foreground/60">
                {new Date(hoveredData.timestamp).toLocaleTimeString()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stats row */}
      <motion.div
        className="mt-3 grid grid-cols-3 gap-3 border-t border-primary/10 pt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        {/* CPU stats */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Cpu className="h-3 w-3" style={{ color: COLORS.cpu }} />
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: COLORS.cpu }}>
                CPU
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendArrow current={currentCpu} prev={prevCpu} />
              <span className="font-mono text-[10px] font-semibold" style={{ color: COLORS.cpu }}>
                {Math.round(currentCpu)}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/60">
            <span>
              L:{Math.round(cpuStats.min)}% H:{Math.round(cpuStats.max)}%
            </span>
            <span>avg {Math.round(cpuStats.avg)}%</span>
          </div>
        </div>

        {/* RAM stats */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <MemoryStick className="h-3 w-3" style={{ color: COLORS.ram }} />
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: COLORS.ram }}>
                RAM
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendArrow current={currentRam} prev={prevRam} />
              <span className="font-mono text-[10px] font-semibold" style={{ color: COLORS.ram }}>
                {Math.round(currentRam)}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/60">
            <span>
              L:{Math.round(ramStats.min)}% H:{Math.round(ramStats.max)}%
            </span>
            <span>avg {Math.round(ramStats.avg)}%</span>
          </div>
        </div>

        {/* Network stats */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Wifi className="h-3 w-3" style={{ color: COLORS.net }} />
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: COLORS.net }}>
                NET
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TrendArrow current={currentNet} prev={prevNet} />
              <span className="font-mono text-[10px] font-semibold" style={{ color: COLORS.net }}>
                {Math.round(currentNet)} Mbps
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground/60">
            <span>
              L:{Math.round(netStats.min)} H:{Math.round(netStats.max)}
            </span>
            <span>avg {Math.round(netStats.avg)}</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}