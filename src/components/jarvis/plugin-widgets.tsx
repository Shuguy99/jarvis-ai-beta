

import { useState } from "react";
import { useSystemData } from "@/hooks/use-system-poller";

// ── System Doctor Widget ────────────────────────────────────────────

export function SystemDoctorWidget() {
  const { system } = useSystemData();

  const checks = system
    ? [
        {
          label: "CPU",
          status: ("ok" as const),
          value: `${system.cpuLoad.toFixed(1)}%`,
        },
        {
          label: "RAM",
          status: ("ok" as const),
          value: `${system.memPct.toFixed(1)}%`,
        },
        {
          label: "Disk",
          status: ("ok" as const),
          value: `${system.diskPct.toFixed(1)}%`,
        },
        {
          label: "Network",
          status: ("ok" as const),
          value: "Online",
        },
      ].map((c) =>
        c.label === "CPU" && system.cpuLoad >= 90
          ? { ...c, status: "fail" as const }
          : c.label === "RAM" && system.memPct >= 90
            ? { ...c, status: "fail" as const }
            : c.label === "Disk" && system.diskPct >= 95
              ? { ...c, status: "fail" as const }
              : c
      )
    : [
        { label: "CPU", status: "loading" as const, value: "" },
        { label: "RAM", status: "loading" as const, value: "" },
        { label: "Disk", status: "loading" as const, value: "" },
        { label: "Network", status: "loading" as const, value: "" },
      ];

  return (
    <div className="space-y-2">
      {checks.map((c) => (
        <div key={c.label} className="flex items-center gap-2 font-mono text-[10px]">
          <span
            className={`h-2 w-2 rounded-full ${
              c.status === "ok"
                ? "bg-emerald-400"
                : c.status === "fail"
                  ? "bg-red-400"
                  : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="w-14 text-muted-foreground">{c.label}</span>
          <span
            className={`flex-1 ${
              c.status === "ok"
                ? "text-emerald-300"
                : c.status === "fail"
                  ? "text-red-400"
                  : "text-amber-300"
            }`}
          >
            {c.value || "..."}
          </span>
          <span className="text-muted-foreground/50">
            {c.status === "ok" ? "OK" : c.status === "fail" ? "WARN" : "CHECK"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Network Scanner Widget ──────────────────────────────────────────

export function NetworkScannerWidget() {
  const { system } = useSystemData();

  const info = system
    ? (() => {
        const lines: string[] = [];
        if (system.hostname) lines.push(`Host: ${system.hostname}`);
        const ip = system.networkInterfaces?.find(
          (i) => !i.internal && i.family === "IPv4"
        );
        if (ip) lines.push(`IP: ${ip.address}`);
        if (system.netSpeedIn > 0) lines.push(`↓ ${system.netSpeedIn.toFixed(1)} Mbps`);
        if (system.netSpeedOut > 0) lines.push(`↑ ${system.netSpeedOut.toFixed(1)} Mbps`);
        return lines.length > 0 ? lines : ["Нет данных"];
      })()
    : ["Загрузка..."];

  return (
    <div className="space-y-1">
      {info.map((line, i) => (
        <div key={i} className="font-mono text-[10px] text-muted-foreground">
          {line}
        </div>
      ))}
    </div>
  );
}

// ── Quick Memo Widget ───────────────────────────────────────────────

export function QuickMemoWidget() {
  const STORAGE = "jarvis-plugin-quick-memo";
  const [text, setText] = useState(() => {
    try {
      return localStorage.getItem(STORAGE) || "";
    } catch {
      return "";
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    localStorage.setItem(STORAGE, val);
  };

  return (
    <div className="space-y-1.5">
      <textarea
        value={text}
        onChange={handleChange}
        placeholder="Быстрая заметка..."
        className="w-full resize-none rounded border jarvis-border-cyan bg-background/40 p-2 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
        rows={3}
      />
      <div className="font-mono text-[9px] text-muted-foreground/50 text-right">
        {text.length} символов
      </div>
    </div>
  );
}