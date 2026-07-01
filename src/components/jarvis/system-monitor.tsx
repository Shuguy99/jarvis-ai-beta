"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Cpu, MemoryStick, Wifi, Thermometer, Activity, Server } from "lucide-react";

interface SystemData {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  cpuModel: string;
  cpuLoad: number;
  memPct: number;
  memUsed: number;
  memTotal: number;
  netThroughput: number;
  processes: number;
  temp: number;
  uptime: number;
  cores: { id: number; load: number }[];
}

function fmtBytes(bytes: number) {
  const gb = bytes / 1024 / 1024 / 1024;
  return `${gb.toFixed(1)} ГБ`;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  return `${h}ч ${m}м`;
}

function Gauge({
  label,
  value,
  max = 100,
  unit = "%",
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-[72px] w-[72px]">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle cx="36" cy="36" r="28" fill="none" stroke="oklch(0.82 0.17 193 / 12%)" strokeWidth="4" />
          <motion.circle
            cx="36"
            cy="36"
            r="28"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-3.5 w-3.5" style={{ color }} />
          <span className="mt-0.5 font-mono text-sm font-semibold" style={{ color }}>
            {Math.round(value)}
            <span className="text-[9px] opacity-70">{unit}</span>
          </span>
        </div>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}

export function SystemMonitor() {
  const [data, setData] = useState<SystemData | null>(null);
  const [netHistory, setNetHistory] = useState<number[]>(Array(24).fill(0));

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/jarvis/system", { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        setData(json);
        setNetHistory((prev) => [...prev.slice(1), json.netThroughput]);
      } catch {
        /* ignore */
      }
    };
    void poll();
    const id = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const cyan = "oklch(0.82 0.17 193)";
  const teal = "oklch(0.78 0.16 165)";
  const amber = "oklch(0.82 0.14 80)";
  const rose = "oklch(0.65 0.22 22)";

  const maxNet = Math.max(200, ...netHistory);

  return (
    <div className="jarvis-box-glow relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-40" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              System Diagnostics
            </span>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 anim-pulse-glow" />
            LIVE
          </span>
        </div>

        {data ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              <Gauge label="CPU" value={data.cpuLoad} color={cyan} icon={Cpu} />
              <Gauge label="RAM" value={data.memPct} color={teal} icon={MemoryStick} />
              <Gauge label="NET" value={data.netThroughput} max={250} unit="" color={amber} icon={Wifi} />
              <Gauge label="TEMP" value={data.temp} max={90} unit="°" color={data.temp > 75 ? rose : cyan} icon={Thermometer} />
            </div>

            {/* Network throughput sparkline */}
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3 w-3" /> Net Throughput
                </span>
                <span className="font-mono text-[10px] text-primary">{data.netThroughput} Mbps</span>
              </div>
              <div className="flex h-10 items-end gap-0.5">
                {netHistory.map((v, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      background: `linear-gradient(to top, ${cyan}, ${cyan}40)`,
                      height: `${Math.max(4, (v / maxNet) * 100)}%`,
                    }}
                    initial={false}
                    animate={{ opacity: i === netHistory.length - 1 ? 1 : 0.55 }}
                  />
                ))}
              </div>
            </div>

            {/* Core loads */}
            <div className="mt-3">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Core Load — {data.cpus} threads
              </div>
              <div className="grid grid-cols-8 gap-1">
                {data.cores.slice(0, 16).map((c) => (
                  <div key={c.id} className="flex flex-col items-center gap-0.5">
                    <div className="relative h-8 w-full overflow-hidden rounded-sm bg-primary/10">
                      <motion.div
                        className="absolute bottom-0 w-full"
                        style={{
                          background: c.load > 80 ? rose : c.load > 60 ? amber : cyan,
                        }}
                        animate={{ height: `${c.load}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <span className="font-mono text-[8px] text-muted-foreground">{c.id}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Specs row */}
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t jarvis-border-cyan pt-2 font-mono text-[10px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">HOST</span>
                <span className="text-foreground/80">{data.hostname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">UPTIME</span>
                <span className="text-foreground/80">{fmtUptime(data.uptime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MEM</span>
                <span className="text-foreground/80">{fmtBytes(data.memUsed)}/{fmtBytes(data.memTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">PROC</span>
                <span className="text-foreground/80">{data.processes}</span>
              </div>
              <div className="col-span-2 flex justify-between">
                <span className="text-muted-foreground">ARCH</span>
                <span className="truncate text-foreground/80" title={data.cpuModel}>
                  {data.platform} · {data.arch}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-40 items-center justify-center font-mono text-xs text-muted-foreground">
            <span className="anim-pulse-glow">Инициализация диагностики…</span>
          </div>
        )}
      </div>
    </div>
  );
}
