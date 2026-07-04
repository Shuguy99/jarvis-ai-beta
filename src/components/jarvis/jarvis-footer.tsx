"use client";

// Футер статуса — ~20 строк, токены ~0.5k, время рендера <1ms
// Извлечён из page.tsx (бывшие строки 969-988)

export function JarvisFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t jarvis-border-cyan bg-card/40 px-4 py-2 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-30" />
      <div className="relative mx-auto flex max-w-[1600px] items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary anim-pulse-glow" />
            Core Stable
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Latency &lt; 1.2s</span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline">Encrypted Channel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline">© Stark Industries</span>
          <span className="text-primary/60">J.A.R.V.I.S.</span>
        </div>
      </div>
    </footer>
  );
}