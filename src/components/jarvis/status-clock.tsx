"use client";

import { useEffect, useState } from "react";

export function StatusClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    // schedule first update on next tick to avoid hydration mismatch
    const t = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, []);

  if (!now) {
    return (
      <div className="font-mono text-sm text-primary/40">
        --:--:--
      </div>
    );
  }

  const time = now.toLocaleTimeString("ru-RU", { hour12: false });
  const date = now.toLocaleDateString("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="text-right">
      <div className="font-mono text-lg font-semibold tracking-wider text-primary jarvis-glow tabular-nums sm:text-xl">
        {time}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {date}
      </div>
    </div>
  );
}
