"use client";

import { useState, useEffect } from "react";

// ── System Doctor Widget ────────────────────────────────────────────

export function SystemDoctorWidget() {
  const [checks, setChecks] = useState<
    { label: string; status: "loading" | "ok" | "fail"; value: string }[]
  >([
    { label: "CPU", status: "loading", value: "" },
    { label: "RAM", status: "loading", value: "" },
    { label: "Disk", status: "loading", value: "" },
    { label: "Network", status: "loading", value: "" },
  ]);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/jarvis/system");
        const data = await res.json();
        setChecks([
          {
            label: "CPU",
            status: (data.cpuUsage ?? 0) < 90 ? "ok" : "fail",
            value: `${data.cpuUsage?.toFixed(1) ?? "?"}%`,
          },
          {
            label: "RAM",
            status: (data.memUsagePercent ?? 0) < 90 ? "ok" : "fail",
            value: `${data.memUsagePercent?.toFixed(1) ?? "?"}%`,
          },
          {
            label: "Disk",
            status: (data.diskUsagePercent ?? 0) < 95 ? "ok" : "fail",
            value: `${data.diskUsagePercent?.toFixed(1) ?? "?"}%`,
          },
          {
            label: "Network",
            status: "ok",
            value: "Online",
          },
        ]);
      } catch {
        setChecks((c) =>
          c.map((x) => ({ ...x, status: "fail" as const, value: "Error" }))
        );
      }
    };
    fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => clearInterval(interval);
  }, []);

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
  const [info, setInfo] = useState<string[]>(["Загрузка..."]);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/jarvis/system");
        const data = await res.json();
        const lines: string[] = [];
        if (data.hostname) lines.push(`Host: ${data.hostname}`);
        if (data.ip) lines.push(`IP: ${data.ip}`);
        if (data.network) {
          if (data.network.rx) lines.push(`↓ ${data.network.rx}`);
          if (data.network.tx) lines.push(`↑ ${data.network.tx}`);
        }
        setInfo(lines.length > 0 ? lines : ["Нет данных"]);
      } catch {
        setInfo(["Ошибка подключения"]);
      }
    };
    fetch_();
    const interval = setInterval(fetch_, 10000);
    return () => clearInterval(interval);
  }, []);

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
  const [text, setText] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE);
    if (saved) setText(saved);
  }, []);

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