

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  ShieldAlert,
  Cpu,
  MemoryStick,
  HardDrive,
  Thermometer,
  Activity,
  XCircle,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import {
  useActivityListener,
  addActivityEvent,
} from "@/components/jarvis/activity-feed";
import { useSystemData, refreshSystemData } from "@/hooks/use-system-poller";

// ── Types ─────────────────────────────────────────────────────
interface AlertEvent {
  id: string;
  message: string;
  severity: "warning" | "error";
  timestamp: number;
}

// ── Thresholds ────────────────────────────────────────────────
type Level = "normal" | "warning" | "critical";

function getCpuLevel(v: number): Level {
  if (v > 85) return "critical";
  if (v >= 60) return "warning";
  return "normal";
}

function getMemLevel(v: number): Level {
  if (v > 85) return "critical";
  if (v >= 70) return "warning";
  return "normal";
}

function getDiskLevel(v: number): Level {
  if (v > 90) return "critical";
  if (v >= 80) return "warning";
  return "normal";
}

function getTempLevel(v: number): Level {
  if (v > 80) return "critical";
  if (v >= 65) return "warning";
  return "normal";
}

const LEVEL_COLOR: Record<Level, string> = {
  normal: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-rose-400",
};

const LEVEL_GLOW: Record<Level, string> = {
  normal: "shadow-[0_0_6px_rgba(52,211,153,0.5)]",
  warning: "shadow-[0_0_6px_rgba(251,191,36,0.5)]",
  critical: "shadow-[0_0_6px_rgba(251,113,133,0.5)]",
};

const LEVEL_TEXT: Record<Level, string> = {
  normal: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-rose-400",
};

// ── Metric bar component ──────────────────────────────────────
function MetricBar({
  icon: Icon,
  label,
  value,
  unit,
  level,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  unit: string;
  level: Level;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 shrink-0 text-muted-foreground/60" />
      <span className="w-8 shrink-0 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-primary/10">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${LEVEL_COLOR[level]} ${LEVEL_GLOW[level]}`}
          initial={false}
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span
        className={`w-10 shrink-0 text-right font-mono text-[11px] tabular-nums ${LEVEL_TEXT[level]}`}
      >
        {Math.round(value)}
        {unit}
      </span>
    </div>
  );
}

// ── Status banner ─────────────────────────────────────────────
function StatusBanner({ status }: { status: "nominal" | "warning" | "critical" }) {
  const reduced = useReducedMotion();
  const config = {
    nominal: {
      text: "ALL SYSTEMS NOMINAL",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/20",
      pulse: "shadow-[0_0_12px_rgba(52,211,153,0.3)]",
    },
    warning: {
      text: "ATTENTION REQUIRED",
      color: "text-amber-400",
      bg: "bg-amber-400/10 border-amber-400/20",
      pulse: "shadow-[0_0_12px_rgba(251,191,36,0.3)]",
    },
    critical: {
      text: "CRITICAL ALERT",
      color: "text-rose-400",
      bg: "bg-rose-400/10 border-rose-400/20",
      pulse: "shadow-[0_0_12px_rgba(251,113,133,0.3)]",
    },
  }[status];

  return (
    <motion.div
      className={`flex items-center justify-center rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] ${config.color} ${config.bg} ${config.pulse}`}
      animate={
        reduced
          ? { opacity: 1 }
          : status === "critical"
            ? { opacity: [1, 0.5, 1] }
            : status === "warning"
              ? { opacity: [1, 0.7, 1] }
              : { opacity: 1 }
      }
      transition={
        reduced || status === "nominal"
          ? { duration: 0 }
          : { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
      }
    >
      {status === "nominal" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
      )}
      {status === "warning" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {status === "critical" && (
        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-rose-400 ${reduced ? "" : "animate-ping"}`} />
      )}
      {config.text}
    </motion.div>
  );
}

// ── Time ago helper ───────────────────────────────────────────
function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "сейчас";
  if (diff < 60) return `${diff}с назад`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}м назад`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}ч назад`;
}

// ── Main component ────────────────────────────────────────────
export function SystemAlertsWidget() {
  const { system } = useSystemData();
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const alertsRef = useRef<AlertEvent[]>([]);

  // ── Listen for warning/error events ───────────────────────
  useActivityListener(
    useCallback(
      (event: {
        id: string;
        message: string;
        severity: string;
        timestamp: number;
      }) => {
        if (event.severity === "warning" || event.severity === "error") {
          const alert: AlertEvent = {
            id: event.id,
            message: event.message,
            severity: event.severity as "warning" | "error",
            timestamp: event.timestamp,
          };
          alertsRef.current = [alert, ...alertsRef.current].slice(0, 5);
          setAlerts([...alertsRef.current]);
        }
      },
      []
    )
  );

  // ── Compute overall status ────────────────────────────────
  const overallStatus = (): "nominal" | "warning" | "critical" => {
    if (!system) return "nominal";
    const levels: Level[] = [
      getCpuLevel(system.cpuLoad),
      getMemLevel(system.memPct),
      getDiskLevel(system.diskPct),
      getTempLevel(system.temp),
    ];
    if (levels.some((l) => l === "critical")) return "critical";
    if (levels.some((l) => l === "warning")) return "warning";
    return "nominal";
  };

  // ── Run diagnostics ───────────────────────────────────────
  const handleDiagnostics = async () => {
    setDiagnosticsRunning(true);
    playSound("scan", 0.2);
    try {
      await refreshSystemData();
      addActivityEvent({
        message: "Диагностика завершена — все системы в норме",
        severity: "success",
        category: "system",
      });
    } catch {
      /* ignore */
    } finally {
      setDiagnosticsRunning(false);
    }
  };

  // ── Clear alerts ──────────────────────────────────────────
  const handleClearAlerts = () => {
    playSound("click");
    alertsRef.current = [];
    setAlerts([]);
  };

  const status = system ? overallStatus() : "nominal";

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
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            System Health
          </span>
        </div>

        {/* Status Banner */}
        <StatusBanner status={status} />

        {/* Metrics */}
        {system ? (
          <div className="flex flex-col gap-2">
            <MetricBar
              icon={Cpu}
              label="CPU"
              value={system.cpuLoad}
              unit="%"
              level={getCpuLevel(system.cpuLoad)}
            />
            <MetricBar
              icon={MemoryStick}
              label="RAM"
              value={system.memPct}
              unit="%"
              level={getMemLevel(system.memPct)}
            />
            <MetricBar
              icon={HardDrive}
              label="Диск"
              value={system.diskPct}
              unit="%"
              level={getDiskLevel(system.diskPct)}
            />
            <MetricBar
              icon={Thermometer}
              label="Темп"
              value={system.temp}
              unit="°C"
              level={getTempLevel(system.temp)}
            />
          </div>
        ) : (
          <div className="flex h-20 items-center justify-center font-mono text-[10px] text-muted-foreground">
            <span className="anim-pulse-glow">Сканирование систем…</span>
          </div>
        )}

        {/* Alert History */}
        {alerts.length > 0 && (
          <div className="border-t jarvis-border-cyan pt-2">
            <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Последние оповещения
            </div>
            <div className="jarvis-scroll max-h-24 flex-col gap-1 overflow-y-auto">
              {alerts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start gap-1.5 border-b border-primary/5 py-1 last:border-0"
                >
                  <span
                    className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                      a.severity === "error" ? "bg-rose-400" : "bg-amber-400"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className={`block truncate font-mono text-[10px] leading-relaxed ${
                        a.severity === "error"
                          ? "text-rose-400/90"
                          : "text-amber-400/90"
                      }`}
                    >
                      {a.message}
                    </span>
                    <span className="font-mono text-[8px] text-muted-foreground/50">
                      {timeAgo(a.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleDiagnostics}
            disabled={diagnosticsRunning}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/10 hover:text-primary/90 disabled:opacity-50"
            aria-label="Запустить диагностику"
          >
            <Activity
              className={`h-3 w-3 ${diagnosticsRunning ? "animate-spin" : ""}`}
            />
            {diagnosticsRunning ? "Сканирование…" : "Диагностика"}
          </button>
          {alerts.length > 0 && (
            <button
              onClick={handleClearAlerts}
              className="flex items-center justify-center gap-1 rounded-md border border-rose-400/20 bg-rose-400/5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-rose-400/80 transition-colors hover:bg-rose-400/10 hover:text-rose-400"
              aria-label="Очистить оповещения"
            >
              <XCircle className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}