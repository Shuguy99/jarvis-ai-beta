

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  RefreshCw,
  AlertTriangle,
  Info,
  CheckCircle,
  TrendingUp,
  Activity,
  Loader2,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import { useSystemData } from "@/hooks/use-system-poller";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

interface Insight {
  type: "info" | "warning" | "critical";
  text: string;
}

interface InsightsData {
  health: number;
  summary: string;
  insights: Insight[];
  timestamp: string;
}

// ── Health Score Circle ───────────────────────────────────────────

function HealthScore({ score }: { score: number }) {
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;
  const color =
    score >= 7
      ? "text-emerald-400"
      : score >= 4
        ? "text-amber-400"
        : "text-red-400";
  const strokeColor =
    score >= 7
      ? "oklch(0.7 0.18 160)"
      : score >= 4
        ? "oklch(0.75 0.18 80)"
        : "oklch(0.7 0.2 25)";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke="oklch(0.3 0.02 250 / 30%)"
          strokeWidth="4"
        />
        <motion.circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`font-mono text-xl font-bold ${color}`}>
          {score}
        </span>
        <span className="font-mono text-[8px] text-muted-foreground/50">
          / 10
        </span>
      </div>
    </div>
  );
}

// ── Mini Sparkline ────────────────────────────────────────────────

function Sparkline({
  data,
  color,
}: {
  data: number[];
  color: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 24;
  const step = w / (data.length - 1);

  const points = data
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-6"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Main Widget ───────────────────────────────────────────────────

export function SystemInsightsWidget() {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { system } = useSystemData();

  // CPU/RAM history for sparklines
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);

  // Update history every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      if (system) {
        setCpuHistory((h) => [...h.slice(-19), system.cpuLoad ?? 0]);
        setRamHistory((h) => [...h.slice(-19), system.memPct ?? 0]);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [system]);

  // Update on first system data
  useEffect(() => {
    if (system) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCpuHistory((h) => [...h.slice(-19), system.cpuLoad ?? 0]);
      setRamHistory((h) => [...h.slice(-19), system.memPct ?? 0]);
    }
  }, [system]);

  const fetchInsights = useCallback(async (manual = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (manual) {
      setLoading(true);
      playSound("activate", 0.3);
    }
    setError(null);

    try {
      const res = await fetch("/api/jarvis/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: abortRef.current.signal,
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
        if (manual) {
          playSound("success", 0.3);
          addActivityEvent({
            message: `Системный анализ: здоровье ${json.health}/10`,
            severity: json.health >= 7 ? "success" : json.health >= 4 ? "warning" : "error",
            category: "system",
          });
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setError("Ошибка анализа");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount + every 5 min
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInsights();
    const interval = setInterval(() => fetchInsights(), 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [fetchInsights]);

  const insightIcon = (type: string) => {
    switch (type) {
      case "critical":
      case "error":
        return <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />;
      case "warning":
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />;
      default:
        return <Info className="h-3.5 w-3.5 text-primary shrink-0" />;
    }
  };

  const insightBorder = (type: string) => {
    switch (type) {
      case "critical":
      case "error":
        return "border-l-red-400";
      case "warning":
        return "border-l-amber-400";
      default:
        return "border-l-primary";
    }
  };

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />

      {/* Header */}
      <div className="relative mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            System Insights
          </span>
        </div>
        <button
          onClick={() => fetchInsights(true)}
          disabled={loading}
          className="flex items-center gap-1 rounded-md border jarvis-border-cyan bg-primary/5 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground transition hover:border-primary/50 hover:text-primary disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
          />
          Обновить
        </button>
      </div>

      <div className="relative">
        {loading && !data ? (
          /* Loading skeleton */
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
            <span className="font-mono text-[10px] text-muted-foreground/50">
              Анализирую систему...
            </span>
          </div>
        ) : error && !data ? (
          /* Error */
          <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="font-mono text-[10px] text-destructive">{error}</span>
          </div>
        ) : data ? (
          <>
            {/* Health Score + Summary */}
            <div className="mb-3 flex items-center gap-4">
              <HealthScore score={data.health} />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] leading-relaxed text-foreground/80">
                  {data.summary}
                </p>
                {data.timestamp && (
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground/40">
                    Последний анализ:{" "}
                    {new Date(data.timestamp).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Sparklines */}
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between font-mono text-[9px] text-muted-foreground/50">
                  <span>CPU</span>
                  <span className="text-primary/60">
                    {system?.cpuLoad?.toFixed(1) ?? "—"}%
                  </span>
                </div>
                <Sparkline data={cpuHistory} color="oklch(0.7 0.18 193)" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between font-mono text-[9px] text-muted-foreground/50">
                  <span>RAM</span>
                  <span className="text-primary/60">
                    {system?.memPct?.toFixed(1) ?? "—"}%
                  </span>
                </div>
                <Sparkline data={ramHistory} color="oklch(0.7 0.2 150)" />
              </div>
            </div>

            {/* Insights list */}
            {data.insights.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto jarvis-scroll">
                {data.insights.map((insight, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-start gap-2 rounded-md border-l-2 ${insightBorder(insight.type)} bg-card/30 px-2.5 py-1.5`}
                  >
                    <div className="mt-0.5">{insightIcon(insight.type)}</div>
                    <span className="font-mono text-[10px] leading-relaxed text-foreground/70">
                      {insight.text}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}