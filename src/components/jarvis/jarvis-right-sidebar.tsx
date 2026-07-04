"use client";

// Правая боковая панель — возможности, виджеты, директивы, таймер, калькулятор
// Извлечён из page.tsx (бывшие строки 796-949)
// Токены ~6k, время рендера ~6ms

import { useCallback, type RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Brain } from "lucide-react";
import { useUIStore } from "@/lib/ui-store";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";
import type { TimerHandle } from "@/components/jarvis/timer-widget";
import { CAPABILITIES, DIRECTIVES } from "@/lib/capabilities";
import { DndWidgetList } from "@/components/jarvis/dnd-widget-list";
import { WidgetErrorBoundary } from "@/components/jarvis/widget-error-boundary";
import { TimerWidget } from "@/components/jarvis/timer-widget";
import { CalculatorWidget } from "@/components/jarvis/calculator-widget";
import {
  MemoizedWeatherWidget, MemoizedWorldClockWidget,
  MemoizedMusicPlayer, MemoizedClipboardWidget,
  MemoizedNetworkWidget, MemoizedProcessManagerWidget,
  MemoizedAmbientSoundWidget, MemoizedPomodoroWidget,
  MemoizedTodoWidget,
} from "@/components/jarvis/memoized-widgets";

interface JarvisRightSidebarProps {
  jarvis: UseJarvisReturn;
  timerRef: RefObject<TimerHandle | null>;
}

// Директивы — внутренний компонент правой панели
function DirectivesSection() {
  return (
    <motion.div
      className="jarvis-holo-glitch jarvis-crt-noise jarvis-box-glow jarvis-corner-brackets relative flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary anim-data-pulse" style={{ animationDelay: "1.5s" }} />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">Directives</span>
        </div>
        <div className="space-y-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {DIRECTIVES.map((d) => (
            <div key={d.num} className="flex gap-2">
              <span className="text-primary/60">{d.num}</span>
              <span>{d.text}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t jarvis-border-cyan pt-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">Build</div>
          <div className="mt-1 font-mono text-[10px] text-foreground/70">JARVIS v14.0.0 · Stark Industries</div>
          <div className="font-mono text-[9px] text-muted-foreground/50">Powered by Ollama local neural core</div>
        </div>
      </div>
    </motion.div>
  );
}

export function JarvisRightSidebar({ jarvis, timerRef }: JarvisRightSidebarProps) {
  const dndMode = useUIStore((s) => s.dndMode);
  const rightWidgetIds = useUIStore((s) => s.rightWidgetIds);
  const setRightWidgetIds = useUIStore((s) => s.setRightWidgetIds);
  const timerVisible = useUIStore((s) => s.timerVisible);
  const calcVisible = useUIStore((s) => s.calcVisible);
  const setCalcVisible = useUIStore((s) => s.setCalcVisible);
  const toggleNotes = useUIStore((s) => s.toggleNotes);

  // DnD widget renderer — используется только в режиме перетаскивания
  const renderRightWidget = useCallback((widgetId: string) => {
    const base = "transition-all duration-300";
    switch (widgetId) {
      case "weather": return <div className={base}><WidgetErrorBoundary name="Weather"><MemoizedWeatherWidget /></WidgetErrorBoundary></div>;
      case "world-clock": return <div className={base}><WidgetErrorBoundary name="World Clock"><MemoizedWorldClockWidget /></WidgetErrorBoundary></div>;
      case "music-player": return <div className={base}><WidgetErrorBoundary name="Music Player"><MemoizedMusicPlayer /></WidgetErrorBoundary></div>;
      case "clipboard": return <div className={base}><WidgetErrorBoundary name="Clipboard"><MemoizedClipboardWidget /></WidgetErrorBoundary></div>;
      case "network": return <div className={base}><WidgetErrorBoundary name="Network"><MemoizedNetworkWidget /></WidgetErrorBoundary></div>;
      case "process-manager": return <div className={base}><WidgetErrorBoundary name="Process Manager"><MemoizedProcessManagerWidget /></WidgetErrorBoundary></div>;
      case "ambient-sound": return <div className={base}><WidgetErrorBoundary name="Ambient Sound"><MemoizedAmbientSoundWidget /></WidgetErrorBoundary></div>;
      case "pomodoro": return <div className={base}><WidgetErrorBoundary name="Pomodoro"><MemoizedPomodoroWidget /></WidgetErrorBoundary></div>;
      case "todo": return <div className={base}><WidgetErrorBoundary name="Tasks"><MemoizedTodoWidget onToggleNotes={() => toggleNotes()} /></WidgetErrorBoundary></div>;
      default: return null;
    }
  }, [toggleNotes]);

  return (
    <aside className="jarvis-scroll flex flex-col gap-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
      {/* Capabilities grid */}
      <motion.div
        className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <Radar className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">Capabilities</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITIES.map((c, i) => (
              <motion.div
                key={c.label}
                className="group rounded-lg border jarvis-border-cyan bg-primary/5 p-2.5 transition hover:bg-primary/10 hover:jarvis-box-glow"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
              >
                <c.icon className="mb-1 h-4 w-4 text-primary/80 transition group-hover:text-primary" />
                <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/80">{c.label}</div>
                <div className="font-mono text-[9px] text-muted-foreground">{c.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* DnD mode или статичные виджеты */}
      {dndMode ? (
        <DndWidgetList widgetIds={rightWidgetIds} onReorder={setRightWidgetIds} columnId="right">
          {(widgetId) => renderRightWidget(widgetId)}
        </DndWidgetList>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
            <WidgetErrorBoundary name="Weather"><MemoizedWeatherWidget /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.37, duration: 0.5 }}>
            <WidgetErrorBoundary name="World Clock"><MemoizedWorldClockWidget /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.38, duration: 0.5 }}>
            <WidgetErrorBoundary name="Music Player"><MemoizedMusicPlayer /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.39, duration: 0.5 }}>
            <WidgetErrorBoundary name="Clipboard"><MemoizedClipboardWidget /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.395, duration: 0.5 }}>
            <WidgetErrorBoundary name="Network"><MemoizedNetworkWidget /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.41, duration: 0.5 }}>
            <WidgetErrorBoundary name="Process Manager"><MemoizedProcessManagerWidget /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.415, duration: 0.5 }}>
            <WidgetErrorBoundary name="Ambient Sound"><MemoizedAmbientSoundWidget /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.42, duration: 0.5 }}>
            <WidgetErrorBoundary name="Pomodoro"><MemoizedPomodoroWidget /></WidgetErrorBoundary>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45, duration: 0.4 }}>
            <WidgetErrorBoundary name="Tasks"><MemoizedTodoWidget onToggleNotes={() => toggleNotes()} /></WidgetErrorBoundary>
          </motion.div>
        </>
      )}

      {/* Timer Widget */}
      <AnimatePresence>
        {timerVisible && (
          <motion.div initial={{ opacity: 0, x: 20, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0, x: 20, height: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
            <TimerWidget ref={timerRef} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calculator Widget */}
      <AnimatePresence>
        {calcVisible && (
          <motion.div initial={{ opacity: 0, x: 20, height: 0 }} animate={{ opacity: 1, x: 0, height: "auto" }} exit={{ opacity: 0, x: 20, height: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
            <CalculatorWidget onClose={() => setCalcVisible(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <DirectivesSection />
    </aside>
  );
}