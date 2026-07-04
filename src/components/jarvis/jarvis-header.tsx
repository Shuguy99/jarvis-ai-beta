

// Хедер JARVIS — кнопки управления, логотип, часы
// Извлечён из page.tsx (бывшие строки 428-549)
// Токены ~2.5k, время рендера ~3ms

import { useUIStore } from "@/lib/ui-store";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";
import { playSound } from "@/lib/sounds";
import { ThemeSwitcher } from "@/components/jarvis/theme-switcher";
import { FullscreenToggle } from "@/components/jarvis/fullscreen-toggle";
import { WindowControls } from "@/components/jarvis/window-controls";
import { StatusClock } from "@/components/jarvis/status-clock";
import {
  Volume2, VolumeX, Ear, EarOff, FileText, Keyboard, Settings,
  Bell, Command,
} from "lucide-react";

interface JarvisHeaderProps {
  jarvis: UseJarvisReturn;
  isWakeListening: boolean;
}

export function JarvisHeader({ jarvis, isWakeListening }: JarvisHeaderProps) {
  // Fine-grained selectors — минимальное количество перерисовок
  const notesOpen = useUIStore((s) => s.notesOpen);
  const wakeWordEnabled = useUIStore((s) => s.wakeWordEnabled);
  const dndMode = useUIStore((s) => s.dndMode);
  const notifOpen = useUIStore((s) => s.notifOpen);
  const paletteOpen = useUIStore((s) => s.paletteOpen);

  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const setWakeWordEnabled = useUIStore((s) => s.setWakeWordEnabled);
  const toggleNotes = useUIStore((s) => s.toggleNotes);
  const toggleDnd = useUIStore((s) => s.toggleDnd);
  const toggleNotif = useUIStore((s) => s.toggleNotif);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setThemeEditorOpen = useUIStore((s) => s.setThemeEditorOpen);

  return (
    <header
      className="relative z-10 flex items-center justify-between border-b jarvis-border-cyan bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-50" />
      <div className="relative flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center">
          <svg viewBox="0 0 40 40" className="absolute inset-0 anim-spin-slow">
            <circle cx="20" cy="20" r="18" fill="none" stroke="oklch(0.85 0.19 193 / 40%)" strokeWidth="1" strokeDasharray="4 4" />
          </svg>
          <div className="h-4 w-4 rounded-full bg-primary jarvis-box-glow-strong" />
        </div>
        <div>
          <h1 className="font-mono text-base font-bold tracking-[0.3em] text-primary jarvis-glow sm:text-lg">
            J.A.R.V.I.S.
          </h1>
          <p className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
            Just A Rather Very Intelligent System
          </p>
        </div>
      </div>

      <div className="relative flex items-center gap-3 overflow-hidden">
        <div className="hidden items-center gap-2 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 lg:flex shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 anim-pulse-glow" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300/90">
            Systems Online
          </span>
        </div>

        {/* Command Palette trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="hidden sm:flex items-center gap-1.5 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:jarvis-box-glow shrink-0"
          title="Командная палитра (Ctrl+K)"
        >
          <Keyboard className="h-3 w-3" />
          <span className="hidden sm:inline">Commands</span>
        </button>

        {/* Notes toggle */}
        <button
          onClick={() => toggleNotes()}
          className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition shrink-0 ${
            notesOpen
              ? "border-primary/50 bg-primary/15 text-primary"
              : "jarvis-border-cyan bg-card/40 text-muted-foreground hover:border-primary/50 hover:text-primary"
          }`}
          title="Заметки"
        >
          <FileText className="h-3 w-3" />
          <span className="hidden sm:inline">Notes</span>
        </button>

        {/* Wake Word Toggle */}
        <button
          onClick={() => setWakeWordEnabled((prev: boolean) => !prev)}
          className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition shrink-0 ${
            wakeWordEnabled
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
          }`}
          title="Wake Word Detection"
        >
          {wakeWordEnabled ? <Ear className="h-3 w-3" /> : <EarOff className="h-3 w-3" />}
          <span className="hidden sm:inline">{wakeWordEnabled ? "Wake: Active" : "Wake: Off"}</span>
          {wakeWordEnabled && isWakeListening && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </button>

        <button
          onClick={() => jarvis.setAutoSpeakOn(!jarvis.autoSpeakOn)}
          className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition shrink-0 ${
            jarvis.autoSpeakOn
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
          }`}
          title="Авто-озвучка ответов"
        >
          {jarvis.autoSpeakOn ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          <span className="hidden sm:inline">{jarvis.autoSpeakOn ? "Voice On" : "Muted"}</span>
        </button>

        {/* DnD Toggle */}
        <button
          onClick={() => { playSound("click"); toggleDnd(); }}
          className={`hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition shrink-0 ${
            dndMode
              ? "border-primary/50 bg-primary/15 text-primary"
              : "jarvis-border-cyan bg-card/40 text-muted-foreground hover:border-primary/50 hover:text-primary"
          }`}
          title="Перетаскивание виджетов (DnD)"
        >
          <Command className="h-3 w-3" />
          <span className="hidden sm:inline">DnD</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => { playSound("click"); toggleNotif(); }}
          className={`hidden sm:flex relative items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition shrink-0 ${
            notifOpen
              ? "border-primary/50 bg-primary/15 text-primary"
              : "jarvis-border-cyan bg-card/40 text-muted-foreground hover:border-primary/50 hover:text-primary"
          }`}
          title="Центр уведомлений"
        >
          <Bell className="h-3 w-3" />
          <span className="hidden sm:inline">Alerts</span>
        </button>

        <button
          onClick={() => { playSound("click"); setSettingsOpen(true); }}
          className="flex items-center gap-1.5 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:jarvis-box-glow shrink-0"
          title="Настройки"
        >
          <Settings className="h-3 w-3" />
        </button>

        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <ThemeSwitcher onOpenEditor={() => setThemeEditorOpen(true)} />
          <FullscreenToggle />
          <WindowControls />
        </div>
        <div className="shrink-0">
          <StatusClock />
        </div>
      </div>
    </header>
  );
}