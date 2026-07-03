"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Cpu, MemoryStick, Wifi, Thermometer, Activity, Server, TrendingUp, HardDrive, Cable } from "lucide-react";

interface NetworkInterfaceInfo {
  name: string;
  family: "IPv4" | "IPv6";
  address: string;
  internal: boolean;
}

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
  diskTotal: number;
  diskUsed: number;
  diskPct: number;
  networkInterfaces: NetworkInterfaceInfo[];
  processMemory: { rss: number; heapUsed: number; heapTotal: number };
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

function fmtMB(bytes: number) {
  const mb = bytes / 1024 / 1024;
  return `${Math.round(mb)} MB`;
}

function isWireless(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.includes("wi") || lower.includes("wlan") || lower.includes("wifi") || lower.includes("wlp");
}

/** Mini SVG sparkline chart */
function Sparkline({ data, color, width = 120, height = 28 }: { data: number[]; color: string; width?: number; height?: number }) {
  const max = Math.max(100, ...data);
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${height - (v / max) * (height - 2)}`).join(" ");
  const areaPts = `0,${height} ${pts} ${width},${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-fill-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#spark-fill-${color.replace(/[^a-z0-9]/gi, "")})`} />
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }}
      />
      {/* Current value dot */}
      {data.length > 0 && (
        <circle
          cx={(data.length - 1) * step}
          cy={height - (data[data.length - 1] / max) * (height - 2)}
          r="2.5"
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
    </svg>
  );
}

function Gauge({
  label,
  value,
  max = 100,
  unit = "%",
  color,
  icon: Icon,
  history,
}: {
  label: string;
  value: number;
  max?: number;
  unit?: string;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  history?: number[];
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
      {/* Mini sparkline under gauge */}
      {history && history.length > 2 && (
        <div className="w-16 h-5 opacity-70">
          <Sparkline data={history} color={color} width={64} height={20} />
        </div>
      )}
    </div>
  );
}

const HISTORY_LEN = 30;

export function SystemMonitor() {
  const [data, setData] = useState<SystemData | null>(null);
  const [netHistory, setNetHistory] = useState<number[]>(Array(24).fill(0));
  const cpuHistoryRef = useRef<number[]>(Array(HISTORY_LEN).fill(0));
  const ramHistoryRef = useRef<number[]>(Array(HISTORY_LEN).fill(0));
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const tickRef = useRef(0);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch("/api/jarvis/system", { cache: "no-store" });
        const json = await res.json();
        if (!active) return;
        setData(json);
        setNetHistory((prev) => [...prev.slice(1), json.netThroughput]);

        // Track CPU/RAM history
        tickRef.current++;
        cpuHistoryRef.current = [...cpuHistoryRef.current.slice(1), json.cpuLoad];
        ramHistoryRef.current = [...ramHistoryRef.current.slice(1), json.memPct];
        if (tickRef.current % 2 === 0) {
          setCpuHistory([...cpuHistoryRef.current]);
          setRamHistory([...ramHistoryRef.current]);
        }
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

  const cyan = "oklch(0.85 0.19 193)";
  const teal = "oklch(0.78 0.16 165)";
  const amber = "oklch(0.82 0.16 80)";
  const rose = "oklch(0.65 0.22 22)";

  const maxNet = Math.max(200, ...netHistory);

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-40" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-primary anim-data-pulse" />
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
              <Gauge label="CPU" value={data.cpuLoad} color={cyan} icon={Cpu} history={cpuHistory} />
              <Gauge label="RAM" value={data.memPct} color={teal} icon={MemoryStick} history={ramHistory} />
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
                      background: `linear-gradient(to top, ${amber}, ${amber}20)`,
                      height: `${Math.max(4, (v / maxNet) * 100)}%`,
                      boxShadow: i === netHistory.length - 1 ? `0 0 6px ${amber}60` : undefined,
                    }}
                    initial={false}
                    animate={{ opacity: i === netHistory.length - 1 ? 1 : 0.4 }}
                  />
                ))}
              </div>
            </div>

            {/* CPU + RAM combined sparkline chart */}
            {(cpuHistory.length > 2 || ramHistory.length > 2) && (
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <TrendingUp className="h-3 w-3" /> CPU / RAM History
                  </span>
                  <span className="flex items-center gap-3 font-mono text-[9px]">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-3 rounded-sm" style={{ background: cyan }} /> CPU
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-3 rounded-sm" style={{ background: teal }} /> RAM
                    </span>
                  </span>
                </div>
                <div className="relative h-12">
                  {cpuHistory.length > 2 && (
                    <div className="absolute inset-0">
                      <Sparkline data={cpuHistory} color={cyan} width={400} height={48} />
                    </div>
                  )}
                  {ramHistory.length > 2 && (
                    <div className="absolute inset-0 opacity-70">
                      <Sparkline data={ramHistory} color={teal} width={400} height={48} />
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {/* Disk usage bar */}
            <div className="mt-3 border-t jarvis-border-cyan pt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <HardDrive className="h-3 w-3" /> Disk
                </span>
                <span className="font-mono text-[10px] text-foreground/80">
                  {fmtBytes(data.diskUsed)} / {fmtBytes(data.diskTotal)} ({data.diskPct}%)
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-sm bg-primary/10">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-sm"
                  style={{
                    background: data.diskPct > 85
                      ? rose
                      : data.diskPct > 70
                        ? amber
                        : cyan,
                    boxShadow: data.diskPct > 85
                      ? `0 0 6px ${rose}80`
                      : data.diskPct > 70
                        ? `0 0 6px ${amber}80`
                        : `0 0 6px ${cyan}80`,
                  }}
                  animate={{ width: `${Math.min(100, data.diskPct)}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>

            {/* Network interfaces */}
            {data.networkInterfaces.length > 0 && (
              <div className="mt-2 border-t jarvis-border-cyan pt-2">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Net Interfaces
                </div>
                <div className="flex flex-col gap-0.5">
                  {data.networkInterfaces.map((iface, idx) => {
                    const IconComp = isWireless(iface.name) ? Wifi : Cable;
                    return (
                      <div key={`${iface.name}-${iface.family}-${idx}`} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                        <IconComp className="h-3 w-3 shrink-0 text-foreground/40" />
                        <span className="text-foreground/70">{iface.name}</span>
                        <span className="text-foreground/30">—</span>
                        <span className="text-foreground/60">{iface.address}</span>
                        <span className="text-foreground/20">{iface.family}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

            {/* JARVIS process memory badge */}
            <div className="mt-2 flex justify-center font-mono text-[9px] text-primary/60">
              CORE: {fmtMB(data.processMemory.rss)} RSS · {fmtMB(data.processMemory.heapUsed)} Heap
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