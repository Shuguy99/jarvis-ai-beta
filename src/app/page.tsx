"use client";

import { useCallback, useRef, useEffect } from "react";
import { useJarvis } from "@/hooks/use-jarvis";
import type { CommandHandlers } from "@/lib/jarvis-store";
import { useWakeWord } from "@/hooks/use-wake-word";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useSystemAlerts } from "@/hooks/use-system-alerts";
import { useProactiveEngine } from "@/hooks/use-proactive-engine";
import { publishSystemMetrics } from "@/lib/context-bus";
import { ArcReactor } from "@/components/jarvis/arc-reactor";
import { ChatPanel } from "@/components/jarvis/chat-panel";
import { QuickCommands } from "@/components/jarvis/quick-commands";
import { ConversationList } from "@/components/jarvis/conversation-list";
import { VoiceControl } from "@/components/jarvis/voice-control";
import { StatusClock } from "@/components/jarvis/status-clock";
import { BootSequence } from "@/components/jarvis/boot-sequence";
import { NewsTicker } from "@/components/jarvis/news-ticker";
import { FullscreenToggle } from "@/components/jarvis/fullscreen-toggle";
import { ThemeSwitcher } from "@/components/jarvis/theme-switcher";
import { ConversationExport } from "@/components/jarvis/conversation-export";
import { JarvisParticles } from "@/components/jarvis/particles";
import { ErrorFlash } from "@/components/jarvis/error-flash";
import { TimerWidget, type TimerHandle } from "@/components/jarvis/timer-widget";
import { CalculatorWidget } from "@/components/jarvis/calculator-widget";
import { WindowControls } from "@/components/jarvis/window-controls";
import { VoiceCommandOverlay } from "@/components/jarvis/voice-command-overlay";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
// Lazy-loaded overlays (code-split)
import { LazyAgentPanel, LazyPluginPanel, LazyLayoutCustomizer, LazyNotificationCenter, LazySettingsPanel, LazyMarkdownWidget, LazyMetricsHistoryChart, JarvisSuspense } from "@/lib/lazy-components";
// Memoized sidebar widgets (prevent re-renders)
import { MemoizedSystemMonitor, MemoizedWeatherWidget, MemoizedWorldClockWidget, MemoizedMusicPlayer, MemoizedClipboardWidget, MemoizedNetworkWidget, MemoizedProcessManagerWidget, MemoizedAmbientSoundWidget, MemoizedPomodoroWidget, MemoizedSessionStatsWidget, MemoizedSystemAlertsWidget, MemoizedShortcutsWidget, MemoizedFileExplorerWidget, MemoizedCalendarWidget, MemoizedActivityFeed, MemoizedQuickLaunchWidget, MemoizedTodoWidget, MemoizedHoloGlobe, MemoizedGitHubWidget } from "@/components/jarvis/memoized-widgets";
import { WidgetErrorBoundary } from "@/components/jarvis/widget-error-boundary";
import { CommandPalette, buildDefaultCommands } from "@/components/jarvis/command-palette";
import { DndWidgetList } from "@/components/jarvis/dnd-widget-list";
import { NotesPanel } from "@/components/jarvis/notes-panel";
import { AlertTriangle, Volume2, VolumeX, Radar, Brain, Ear, EarOff, FileText, Keyboard, Settings, Monitor, Bell, Mic, Search, FileCode, Bot, Puzzle, LayoutGrid, Command } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sounds";
import { showNotification, NotificationToastContainer } from "@/components/jarvis/notification-toast";
import { QuickActionsBar, type QuickAction } from "@/components/jarvis/quick-actions-bar";
import { useUIStore } from "@/lib/ui-store";
import { CAPABILITIES, DIRECTIVES } from "@/lib/capabilities";

function DirectivesSection() {
  return (
    <motion.div className="jarvis-holo-glitch jarvis-crt-noise jarvis-box-glow jarvis-corner-brackets relative flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
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

export default function Home() {
  // ── Zustand state selectors (individual for fine-grained reactivity) ──
  const booted = useUIStore(s => s.booted);
  const wakeWordEnabled = useUIStore(s => s.wakeWordEnabled);
  const notesOpen = useUIStore(s => s.notesOpen);
  const timerVisible = useUIStore(s => s.timerVisible);
  const calcVisible = useUIStore(s => s.calcVisible);
  const paletteOpen = useUIStore(s => s.paletteOpen);
  const settingsOpen = useUIStore(s => s.settingsOpen);
  const markdownOpen = useUIStore(s => s.markdownOpen);
  const agentOpen = useUIStore(s => s.agentOpen);
  const pluginOpen = useUIStore(s => s.pluginOpen);
  const layoutOpen = useUIStore(s => s.layoutOpen);
  const notifOpen = useUIStore(s => s.notifOpen);
  const searchOpen = useUIStore(s => s.searchOpen);
  const dndMode = useUIStore(s => s.dndMode);
  const jarvisSettings = useUIStore(s => s.jarvisSettings);
  const leftWidgetIds = useUIStore(s => s.leftWidgetIds);
  const rightWidgetIds = useUIStore(s => s.rightWidgetIds);

  // ── Zustand actions (stable references, safe to destructure together) ──
  const {
    setBooted, setWakeWordEnabled, toggleNotes, setNotesOpen,
    setTimerVisible, toggleTimer, setCalcVisible, toggleCalc,
    setPaletteOpen, setSettingsOpen, setMarkdownOpen,
    setAgentOpen, setPluginOpen, setLayoutOpen,
    setNotifOpen, toggleNotif, setSearchOpen,
    setDndMode, toggleDnd, setJarvisSettings,
    setLeftWidgetIds, setRightWidgetIds, closeAllPanels,
  } = useUIStore();

  const timerRef = useRef<TimerHandle>(null);

  // Load behavior settings from DB on mount
  useEffect(() => {
    fetch("/api/jarvis/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const s = data.settings;
          setJarvisSettings({
            ttsRate: parseFloat(s.ttsRate) || 1.05,
            ttsPitch: parseFloat(s.ttsPitch) || 0.95,
            volume: parseFloat(s.volume) ?? 1.0,
            autoSpeak: s.autoSpeak !== "false",
            language: s.language || "ru",
            persona: s.persona || "classic",
            userName: s.userName || "",
            formality: parseFloat(s.formality) || 0.7,
            humor: parseFloat(s.humor) || 0.4,
            responseStyle: s.responseStyle || "standard",
            temperature: parseFloat(s.temperature) || 0.7,
            maxTokens: parseInt(s.maxTokens, 10) || 2048,
            contextWindow: parseInt(s.contextWindow, 10) || 20,
            customPrompt: s.customPrompt || "",
          });
        }
      })
      .catch(() => { /* use defaults */ });
  }, [setJarvisSettings]);

  const jarvis = useJarvis({ autoSpeak: true, ttsRate: 1.05, ttsPitch: 0.92, settings: jarvisSettings ?? undefined });

  // Voice command NLP parser
  const { lastCommand, processText: _processVoiceCommand } = useVoiceCommands({
    toggle_fullscreen: () => { void toggleFullscreen(); },
    new_chat: () => jarvis.newConversation(),
    toggle_notes: () => toggleNotes(),
    capture_screen: () => { if (jarvis.captureScreen) void jarvis.captureScreen(); },
    toggle_voice: (params: Record<string, string>) => {
      const dir = params.direction;
      if (dir === "off" || dir === "mute") jarvis.setAutoSpeakOn(false);
      else if (dir === "on" || dir === "unmute") jarvis.setAutoSpeakOn(true);
      else jarvis.setAutoSpeakOn(!jarvis.autoSpeakOn);
    },
    open_widget: (params: Record<string, string>) => {
      const w = params.widget;
      if (w === "заметки" || w === "notes") setNotesOpen(true);
      else if (w === "настройки" || w === "settings") setSettingsOpen(true);
      else if (w === "калькулятор" || w === "calculator") setCalcVisible(true);
      else if (w === "агент" || w === "agent") setAgentOpen(true);
      else if (w === "плагины" || w === "plugins") setPluginOpen(true);
      else if (w === "раскладка" || w === "layout") setLayoutOpen(true);
      else if (w === "markdown") setMarkdownOpen(true);
      else if (w === "файлы" || w === "files") { /* scroll to widget */ }
      else if (w === "календарь" || w === "calendar") { /* scroll to widget */ }
    },
    set_timer: (params: Record<string, string>) => {
      setTimerVisible(true);
      const secs = parseInt(params.seconds || "0", 10);
      if (secs > 0) timerRef.current?.startTimer(secs);
    },
    start_pomodoro: () => { /* TODO: trigger pomodoro */ },
    calculator: () => toggleCalc(),
  }, { speak: (text: string) => jarvis.speak(text) });

  const handleBootComplete = useCallback(() => {
    setBooted(true);
    showNotification({ title: "J.A.R.V.I.S. Online", message: "Все системы в норме. Ожидаю ваших указаний, сэр.", type: "success" });
  }, [setBooted]);

  // Set up command handlers for the hook
  useEffect(() => {
    const handlers: CommandHandlers = {
      startTimer: (seconds: number) => {
        setTimerVisible(true);
        timerRef.current?.startTimer(seconds);
      },
      stopTimer: () => timerRef.current?.stop(),
      resetTimer: () => timerRef.current?.reset(),
      toggleNotes: () => toggleNotes(),
      openNotes: () => setNotesOpen(true),
      toggleFullscreen: async () => {
        try {
          if (document.fullscreenElement) await document.exitFullscreen();
          else await document.documentElement.requestFullscreen();
        } catch { /* ignore */ }
      },
      setTheme: (id: string) => {
        document.documentElement.setAttribute("data-theme", id);
        localStorage.setItem("jarvis-theme", id);
      },
      toggleCalculator: () => toggleCalc(),
      captureScreen: () => {
        if (jarvis.captureScreen) void jarvis.captureScreen();
      },
      openSettings: () => setSettingsOpen(true),
    };
    jarvis.setCommandHandlers(handlers);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jarvis methods (captureScreen, setCommandHandlers) change every render; setCommandHandlers is already tracked
  }, [jarvis.setCommandHandlers, jarvis.captureScreen, setNotesOpen, setSettingsOpen, setTimerVisible, toggleCalc, toggleNotes]);

  // System alerts → Activity Feed
  useSystemAlerts();

  // Proactive Engine — JARVIS initiates actions based on system/weather/calendar context
  useProactiveEngine({ enabled: true, voiceAlerts: true });

  // Context Bus — publish system metrics for cross-module correlation
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/jarvis/system", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        publishSystemMetrics({
          cpuLoad: data.cpuLoad ?? 0,
          memPct: data.memPct ?? 0,
          diskPct: data.diskPct ?? 0,
          temp: data.temp ?? 0,
          netSpeedIn: data.netSpeedIn ?? 0,
          netSpeedOut: data.netSpeedOut ?? 0,
        });
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  // Global hotkeys
  useHotkeys({
    onToggleTimer: () => toggleTimer(),
    onToggleCalc: () => toggleCalc(),
    onToggleNotes: () => toggleNotes(),
    onOpenSettings: () => setSettingsOpen(true),
    onNewChat: () => jarvis.newConversation(),
    onToggleVoice: () => jarvis.toggleListening(),
    onToggleFullscreen: async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { /* ignore */ }
    },
    onOpenPalette: () => setPaletteOpen(true),
  });

  // Fullscreen toggle helper (for command palette)
  const toggleFullscreen = useCallback(async () => {
    playSound("activate");
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* ignore */ }
  }, []);

  // Wake word detection
  const handleWakeWord = useCallback(() => {
    jarvis.startListening();
  }, [jarvis]);

  const { isListening: isWakeListening } = useWakeWord({
    enabled: wakeWordEnabled,
    onWakeWord: handleWakeWord,
  });

  // Error flash — key changes on each new error message
  const errorFlashKey = jarvis.state === "error" ? jarvis.error ?? "err" : 0;

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K → Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      // Ctrl+M → toggle microphone
      if ((e.ctrlKey || e.metaKey) && e.key === "m") {
        e.preventDefault();
        jarvis.toggleListening();
        return;
      }
      // Ctrl+N → new conversation
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        jarvis.newConversation();
        return;
      }
      // Escape → close panels / stop speaking
      if (e.key === "Escape") {
        if (paletteOpen || settingsOpen || notesOpen || markdownOpen || agentOpen || pluginOpen || layoutOpen || notifOpen) {
          closeAllPanels();
          return;
        }
        if (jarvis.state === "speaking") {
          jarvis.stopSpeaking();
          return;
        }
      }
      // F11 → fullscreen
      if (e.key === "F11") {
        e.preventDefault();
        void toggleFullscreen();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jarvis, closeAllPanels, paletteOpen, settingsOpen, notesOpen, markdownOpen, agentOpen, pluginOpen, layoutOpen, notifOpen, toggleFullscreen, setPaletteOpen]);

  // Build commands for palette
  const commands = buildDefaultCommands({
    newConversation: () => jarvis.newConversation(),
    toggleListening: () => jarvis.toggleListening(),
    toggleFullscreen,
    openSettings: () => {
      playSound("click");
      setSettingsOpen(true);
    },
    toggleNotes: () => toggleNotes(),
    toggleTimer: () => toggleTimer(),
    setTheme: (id: string) => {
      document.documentElement.setAttribute("data-theme", id);
      localStorage.setItem("jarvis-theme", id);
    },
    toggleCalculator: () => toggleCalc(),
    captureScreen: () => {
      if (jarvis.captureScreen) void jarvis.captureScreen();
    },
    toggleWakeWord: () => setWakeWordEnabled((v) => !v),
  });

  // Widget render functions for DnD mode
  const renderLeftWidget = useCallback((widgetId: string) => {
    const base = "transition-all duration-300";
    switch (widgetId) {
      case "quick-launch": return <div className={base}><WidgetErrorBoundary name="Quick Launch"><MemoizedQuickLaunchWidget /></WidgetErrorBoundary></div>;
      case "system-monitor": return <div className={`jarvis-holo-glitch jarvis-crt-noise flex-shrink-0 ${base}`}><WidgetErrorBoundary name="System Diagnostics"><MemoizedSystemMonitor /></WidgetErrorBoundary></div>;
      case "metrics-history": return <div className={base}><JarvisSuspense><LazyMetricsHistoryChart /></JarvisSuspense></div>;
      case "activity-feed": return <div className={base}><WidgetErrorBoundary name="Activity Feed"><MemoizedActivityFeed /></WidgetErrorBoundary></div>;
      case "system-alerts": return <div className={base}><WidgetErrorBoundary name="System Alerts"><MemoizedSystemAlertsWidget /></WidgetErrorBoundary></div>;
      case "holo-globe": return (
        <div className={`jarvis-box-glow jarvis-corner-brackets relative flex items-center justify-center overflow-hidden rounded-xl border jarvis-border-cyan bg-card/20 p-2 backdrop-blur-sm ${base}`}>
          <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
          <WidgetErrorBoundary name="Holo Globe"><MemoizedHoloGlobe size={220} /></WidgetErrorBoundary>
        </div>
      );
      case "session-stats": return <div className={base}><WidgetErrorBoundary name="Session Stats"><MemoizedSessionStatsWidget /></WidgetErrorBoundary></div>;
      case "shortcuts": return <div className={base}><WidgetErrorBoundary name="Shortcuts"><MemoizedShortcutsWidget /></WidgetErrorBoundary></div>;
      case "file-explorer": return <div className={base}><WidgetErrorBoundary name="File Explorer"><MemoizedFileExplorerWidget /></WidgetErrorBoundary></div>;
      case "calendar": return <div className={base}><WidgetErrorBoundary name="Calendar"><MemoizedCalendarWidget /></WidgetErrorBoundary></div>;
      case "github": return <div className={base}><WidgetErrorBoundary name="GitHub"><MemoizedGitHubWidget /></WidgetErrorBoundary></div>;
      default: return null;
    }
  }, []);

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

  // Get active conversation title for export
  const activeTitle = jarvis.conversations.find(c => c.id === jarvis.activeConvoId)?.title;

  return (
    <div className="jarvis-desktop-no-scroll jarvis-no-select jarvis-smooth-resize flex min-h-screen flex-col bg-background text-foreground">
      {/* ===== Error Flash Overlay ===== */}
      {jarvis.state === "error" && <ErrorFlash key={errorFlashKey} />}

      {/* ===== Notification Toasts ===== */}
      <NotificationToastContainer />

      {/* ===== Boot Sequence Overlay ===== */}
      <BootSequence onComplete={handleBootComplete} />

      {/* ===== Voice Command Overlay ===== */}
      <VoiceCommandOverlay command={lastCommand} />

      {/* ===== Command Palette ===== */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
        messages={jarvis.messages.map(m => ({ id: m.id, content: m.content, role: m.role, createdAt: m.createdAt }))}
        conversations={jarvis.conversations.map(c => ({ id: c.id, title: c.title || "Без названия", updatedAt: c.updatedAt }))}
      />

      {/* ===== Settings Panel ===== */}
      <JarvisSuspense>
        <LazySettingsPanel
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onSave={(s) => {
            jarvis.updateTTSSettings?.(s.ttsRate, s.ttsPitch, s.volume);
            if (s.autoSpeak !== jarvis.autoSpeakOn) jarvis.setAutoSpeakOn(s.autoSpeak);
            setJarvisSettings(s);
            showNotification({ title: "Конфигурация сохранена", message: "Настройки JARVIS обновлены", type: "success" });
          }}
        />
      </JarvisSuspense>

      {/* ===== Main Content (fades in after boot) ===== */}
      <AnimatePresence>
        {booted && (
          <motion.div
            className="jarvis-no-select flex min-h-screen flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* ===== News Ticker ===== */}
            <NewsTicker />

            {/* ===== Header ===== */}
            <header className="relative z-10 flex items-center justify-between border-b jarvis-border-cyan bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
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

              <div className="relative flex items-center gap-3">
                <div className="hidden items-center gap-2 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 lg:flex">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 anim-pulse-glow" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300/90">
                    Systems Online
                  </span>
                </div>

                {/* Command Palette trigger */}
                <button
                  onClick={() => setPaletteOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:jarvis-box-glow"
                  title="Командная палитра (Ctrl+K)"
                >
                  <Keyboard className="h-3 w-3" />
                  <span className="hidden sm:inline">Commands</span>
                </button>

                {/* Notes toggle */}
                <button
                  onClick={() => toggleNotes()}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
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
                  onClick={() => setWakeWordEnabled(prev => !prev)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
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
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
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
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
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
                  className={`relative flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
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
                  className="flex items-center gap-1.5 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:jarvis-box-glow"
                  title="Настройки"
                >
                  <Settings className="h-3 w-3" />
                </button>
                <ThemeSwitcher />
                <FullscreenToggle />
                <WindowControls />
                <StatusClock />
              </div>
            </header>

            {/* ===== Main ===== */}
            <main className="relative flex-1 overflow-hidden">
              {/* React floating particles */}
              <JarvisParticles count={40} />
              <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

              {/* ===== Notes Panel Overlay ===== */}
              <AnimatePresence>
                {notesOpen && (
                  <motion.div
                    className="absolute right-4 top-3 z-30 w-80 sm:w-96"
                    initial={{ opacity: 0, x: 40, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <NotesPanel
                      open={notesOpen}
                      onClose={() => setNotesOpen(false)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ===== Markdown Editor Overlay ===== */}
              <AnimatePresence>
                {markdownOpen && (
                  <motion.div
                    className="absolute right-4 top-3 z-30 w-[400px] sm:w-[520px]"
                    initial={{ opacity: 0, x: 40, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <JarvisSuspense><LazyMarkdownWidget onClose={() => setMarkdownOpen(false)} /></JarvisSuspense>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ===== Agent Panel Overlay ===== */}
              <JarvisSuspense><LazyAgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} /></JarvisSuspense>

              {/* ===== Plugin Panel Overlay ===== */}
              <JarvisSuspense><LazyPluginPanel open={pluginOpen} onClose={() => setPluginOpen(false)} /></JarvisSuspense>

              {/* ===== Layout Customizer Overlay ===== */}
              <JarvisSuspense><LazyLayoutCustomizer open={layoutOpen} onClose={() => setLayoutOpen(false)} /></JarvisSuspense>

              {/* ===== Notification Center Overlay ===== */}
              <JarvisSuspense><LazyNotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} /></JarvisSuspense>

              <div className="relative mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:gap-4 lg:p-4">
                {/* Left sidebar */}
                <aside className="jarvis-scroll flex flex-col gap-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
                  {dndMode ? (
                    <DndWidgetList widgetIds={leftWidgetIds} onReorder={setLeftWidgetIds} columnId="left">
                      {(widgetId) => renderLeftWidget(widgetId)}
                    </DndWidgetList>
                  ) : (
                    <>
                  {/* Quick Launch */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Quick Launch"><MemoizedQuickLaunchWidget /></WidgetErrorBoundary>
                  </motion.div>

                  <motion.div
                    className="jarvis-holo-glitch jarvis-crt-noise flex-shrink-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                  >
                    <WidgetErrorBoundary name="System Diagnostics"><MemoizedSystemMonitor /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Metrics History Chart */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.22, duration: 0.6 }}
                  >
                    <JarvisSuspense><LazyMetricsHistoryChart /></JarvisSuspense>
                  </motion.div>

                  {/* Activity Feed */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.32, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Activity Feed"><MemoizedActivityFeed /></WidgetErrorBoundary>
                  </motion.div>

                  {/* System Alerts Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.33, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="System Alerts"><MemoizedSystemAlertsWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Holographic Globe */}
                  <motion.div
                    className="jarvis-box-glow jarvis-corner-brackets relative flex items-center justify-center overflow-hidden rounded-xl border jarvis-border-cyan bg-card/20 p-2 backdrop-blur-sm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.6 }}
                  >
                    <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
                    <WidgetErrorBoundary name="Holo Globe"><MemoizedHoloGlobe size={220} /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Session Stats */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.36, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Session Stats"><MemoizedSessionStatsWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Keyboard Shortcuts */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.37, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Shortcuts"><MemoizedShortcutsWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* File Explorer */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.38, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="File Explorer"><MemoizedFileExplorerWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Calendar */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.39, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Calendar"><MemoizedCalendarWidget /></WidgetErrorBoundary>
                  </motion.div>
                    </>
                  )}
                  <motion.div
                    className="jarvis-box-glow jarvis-corner-brackets relative min-h-[160px] flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-3 backdrop-blur-sm lg:min-h-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                  >
                    <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
                    <ConversationList
                      conversations={jarvis.conversations}
                      activeId={jarvis.activeConvoId}
                      onSelect={jarvis.selectConversation}
                      onNew={jarvis.newConversation}
                      onDelete={jarvis.deleteConversation}
                    />
                  </motion.div>
                </aside>

                {/* Center column */}
                <section className="flex flex-col gap-3 lg:col-span-6 lg:max-h-[calc(100vh-12rem)] lg:overflow-hidden">
                  {/* Hero: arc reactor + voice + quick commands */}
                  <motion.div
                    className="jarvis-box-glow jarvis-hologram jarvis-noise relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
                    initial={{ opacity: 0, y: 20, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
                  >
                    <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
                    <div className="pointer-events-none absolute inset-0 jarvis-data-stream opacity-30" />
                    <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-1 flex-col items-center gap-2">
                        <ArcReactor state={jarvis.state} audioLevel={jarvis.audioLevel} size={180} />
                        <div className="mt-2 flex items-center gap-2">
                          {jarvis.error ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 font-mono text-[10px] text-destructive"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              <span className="max-w-[200px] truncate">{jarvis.error}</span>
                            </motion.div>
                          ) : (
                            <p className="text-center font-mono text-[11px] leading-relaxed text-muted-foreground jarvis-text-terminal">
                              {jarvis.state === "idle" && "» Системы в норме. Готов к выполнению задач, сэр."}
                              {jarvis.state === "listening" && "» Слушаю вас…"}
                              {jarvis.state === "thinking" && "» Обрабатываю запрос…"}
                              {jarvis.state === "speaking" && "» Воспроизвожу ответ…"}
                              {jarvis.state === "error" && "» Обнаружена аномалия. Требуется повтор."}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-center sm:items-end">
                        <VoiceControl jarvis={jarvis} />
                      </div>
                    </div>
                    <div className="relative mt-4 border-t jarvis-border-cyan pt-3">
                      <QuickCommands onPick={(p) => jarvis.sendText(p, "text")} onImageGen={(p) => jarvis.generateImage(p)} />
                    </div>
                  </motion.div>

                  {/* Chat */}
                  <motion.div
                    className="jarvis-holo-glitch jarvis-box-glow jarvis-gradient-border jarvis-data-stream-v2 jarvis-border-pulse relative flex min-h-[340px] flex-1 overflow-hidden rounded-xl bg-card/40 backdrop-blur-sm lg:min-h-0"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                  >
                    <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-40" />
                    <div className="relative flex w-full flex-col">
                      <div className="flex items-center justify-between border-b jarvis-border-cyan px-4 py-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80 jarvis-glow">
                          Dialogue Interface
                        </span>
                        <div className="flex items-center gap-3">
                          {jarvis.messages.length > 0 && (
                            <ConversationExport messages={jarvis.messages} conversationTitle={activeTitle} />
                          )}
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {jarvis.messages.length} messages
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <ChatPanel jarvis={jarvis} />
                      </div>
                    </div>
                  </motion.div>
                </section>

                {/* Right sidebar */}
                <aside className="jarvis-scroll flex flex-col gap-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
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
                        <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
                          Capabilities
                        </span>
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
                            <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
                              {c.label}
                            </div>
                            <div className="font-mono text-[9px] text-muted-foreground">{c.desc}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {dndMode ? (
                    <DndWidgetList widgetIds={rightWidgetIds} onReorder={setRightWidgetIds} columnId="right">
                      {(widgetId) => renderRightWidget(widgetId)}
                    </DndWidgetList>
                  ) : (
                    <>
                  {/* Weather Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Weather"><MemoizedWeatherWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* World Clock */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.37, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="World Clock"><MemoizedWorldClockWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Music Player */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.38, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Music Player"><MemoizedMusicPlayer /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Clipboard Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.39, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Clipboard"><MemoizedClipboardWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Network Traffic */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.395, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Network"><MemoizedNetworkWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Process Manager */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.41, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Process Manager"><MemoizedProcessManagerWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Ambient Sound */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.415, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Ambient Sound"><MemoizedAmbientSoundWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* Pomodoro Focus */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.42, duration: 0.5 }}
                  >
                    <WidgetErrorBoundary name="Pomodoro"><MemoizedPomodoroWidget /></WidgetErrorBoundary>
                  </motion.div>

                  {/* TODO Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                  >
                    <WidgetErrorBoundary name="Tasks"><MemoizedTodoWidget onToggleNotes={() => toggleNotes()} /></WidgetErrorBoundary>
                  </motion.div>
                    </>
                  )}

                  {/* Timer Widget */}
                  <AnimatePresence>
                    {timerVisible && (
                      <motion.div
                        initial={{ opacity: 0, x: 20, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: "auto" }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                      >
                        <TimerWidget ref={timerRef} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Calculator Widget */}
                  <AnimatePresence>
                    {calcVisible && (
                      <motion.div
                        initial={{ opacity: 0, x: 20, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: "auto" }}
                        exit={{ opacity: 0, x: 20, height: 0 }}
                        transition={{ delay: 0.4, duration: 0.4 }}
                      >
                        <CalculatorWidget onClose={() => setCalcVisible(false)} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Directives */}
                  <DirectivesSection />
                </aside>
              </div>
            </main>

            {/* ===== Quick Actions Bar ===== */}
            <QuickActionsBar
              actions={[
                { icon: Mic, label: "Голос", onClick: () => jarvis.toggleListening() },
                { icon: Search, label: "Поиск", onClick: () => jarvis.sendText("Найди информацию о", "text") },
                { icon: Monitor, label: "Экран", onClick: () => { if (jarvis.captureScreen) void jarvis.captureScreen(); } },
                { icon: FileText, label: "Заметки", onClick: () => toggleNotes() },
                { icon: FileCode, label: "Markdown", onClick: () => setMarkdownOpen((v: boolean) => !v) },
                { icon: Bot, label: "Агент", onClick: () => setAgentOpen((v: boolean) => !v) },
                { icon: Puzzle, label: "Плагины", onClick: () => setPluginOpen((v: boolean) => !v) },
                { icon: LayoutGrid, label: "Раскладка", onClick: () => setLayoutOpen((v: boolean) => !v) },
                { icon: Settings, label: "Настройки", onClick: () => { playSound("click"); setSettingsOpen(true); } },
              ] as QuickAction[]}
            />

            {/* ===== Footer ===== */}
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}