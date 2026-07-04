

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { Globe, Sun, Moon } from "lucide-react";

interface ClockCity {
  name: string;
  tz: string;
  label: string;
  flag: string;
}

const CITIES: ClockCity[] = [
  { name: "Новосибирск", tz: "Asia/Novosibirsk", label: "NSK", flag: "🇷🇺" },
  { name: "Москва", tz: "Europe/Moscow", label: "MSK", flag: "🇷🇺" },
  { name: "Лондон", tz: "Europe/London", label: "LDN", flag: "🇬🇧" },
  { name: "Нью-Йорк", tz: "America/New_York", label: "NYC", flag: "🇺🇸" },
  { name: "Токио", tz: "Asia/Tokyo", label: "TKY", flag: "🇯🇵" },
  { name: "Дубай", tz: "Asia/Dubai", label: "DXB", flag: "🇦🇪" },
];

function getTimeInTZ(tz: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const s = parseInt(parts.find((p) => p.type === "second")?.value ?? "0", 10);

  // Day of week
  const dayPart = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
  }).format(now);

  // Date
  const datePart = new Intl.DateTimeFormat("ru-RU", {
    timeZone: tz,
    day: "numeric",
    month: "short",
  }).format(now);

  // Is daytime? (rough: 6-22)
  const isDay = h >= 6 && h < 22;

  return { h, m, s, dayPart, datePart, isDay };
}

function formatTime(h: number, m: number, s: number): string {
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function WorldClockWidget() {
  const [, setTick] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Use requestAnimationFrame for smooth second updates
    let lastSecond = -1;
    const loop = () => {
      const now = new Date().getSeconds();
      if (now !== lastSecond) {
        lastSecond = now;
        setTick((t) => t + 1);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Calculate time differences from Новосибирск
  const now = new Date();
  const nskOffset = -now.getTimezoneOffset() + (-(now.getTimezoneOffset() - new Date().getTimezoneOffset()));
  const baseTime = getTimeInTZ("Asia/Novosibirsk");

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Global Clock
            </span>
          </div>
          <span className="font-mono text-[9px] text-muted-foreground/60">
            {baseTime.datePart}
          </span>
        </div>

        {/* Clock grid */}
        <div className="space-y-1.5">
          {CITIES.map((city, i) => {
            const t = getTimeInTZ(city.tz);
            const isLocal = city.tz === "Asia/Novosibirsk";

            return (
              <motion.div
                key={city.tz}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition ${
                  isLocal
                    ? "border border-primary/30 bg-primary/10"
                    : "hover:bg-primary/5"
                }`}
              >
                <span className="text-sm flex-shrink-0">{city.flag}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-[10px] font-semibold uppercase tracking-wider ${
                      isLocal ? "text-primary" : "text-foreground/80"
                    }`}>
                      {city.label}
                    </span>
                    {isLocal && (
                      <span className="rounded bg-primary/20 px-1 py-px font-mono text-[8px] uppercase text-primary">
                        local
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground/60">{city.name}</span>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  <span className="text-muted-foreground/40">
                    {t.isDay ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
                  </span>
                  <span className={`font-mono text-sm tabular-nums font-semibold tracking-wide ${
                    isLocal ? "text-primary jarvis-glow" : "text-foreground/90"
                  }`}>
                    {formatTime(t.h, t.m, t.s)}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground/40 w-6 text-right">
                    {t.dayPart}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}