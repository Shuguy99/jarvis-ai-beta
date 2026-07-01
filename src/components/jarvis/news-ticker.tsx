"use client";

import { useEffect, useState } from "react";
import { Radio } from "lucide-react";

interface Headline {
  title: string;
  url?: string;
  snippet?: string;
}

export function NewsTicker() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/jarvis/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "последние новости технологий сегодня",
            messages: [],
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.results && Array.isArray(data.results)) {
          const items: Headline[] = data.results.slice(0, 8).map((r: { title?: string; url?: string; snippet?: string }) => ({
            title: r.title || "—",
            url: r.url,
            snippet: r.snippet,
          }));
          setHeadlines(items);
        }
      } catch {
        /* silent */
      }
      if (!cancelled) setFetched(true);
    };
    void load();
    const iv = setInterval(() => void load(), 300_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  if (!fetched) return null;

  const text =
    headlines.length > 0
      ? headlines.map((h) => h.title).join("  ●  ")
      : "JARVIS GLOBAL FEED — STANDBY";

  const doubled = `${text}  ●  ${text}  ●  `;

  return (
    <div className="relative z-20 flex items-center gap-3 overflow-hidden border-b jarvis-border-cyan bg-card/20 px-3 py-1.5 backdrop-blur-sm">
      <div className="relative flex flex-shrink-0 items-center gap-1.5">
        <Radio className="h-3 w-3 text-primary anim-data-pulse" />
        <span className="font-mono text-[9px] uppercase tracking-widest text-primary/90">
          Live
        </span>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <div
          className="flex whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.15em] text-primary/60"
          style={{
            animation: "ticker-scroll 60s linear infinite",
          }}
        >
          {doubled}
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}