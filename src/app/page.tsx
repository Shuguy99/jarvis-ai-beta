"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useJarvis, type CommandHandlers } from "@/hooks/use-jarvis";
import { useWakeWord } from "@/hooks/use-wake-word";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useSystemAlerts } from "@/hooks/use-system-alerts";
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
import { SystemInsightsWidget } from "@/components/jarvis/system-insights-widget";
// Lazy-loaded overlays (code-split)
import { LazyAgentPanel, LazyPluginPanel, LazyLayoutCustomizer, LazyNotificationCenter, LazySettingsPanel, LazyMarkdownWidget, LazyMetricsHistoryChart, JarvisSuspense } from "@/lib/lazy-components";
// Memoized sidebar widgets (prevent re-renders)
import { MemoizedSystemMonitor, MemoizedWeatherWidget, MemoizedWorldClockWidget, MemoizedMusicPlayer, MemoizedClipboardWidget, MemoizedNetworkWidget, MemoizedProcessManagerWidget, MemoizedAmbientSoundWidget, MemoizedPomodoroWidget, MemoizedSessionStatsWidget, MemoizedSystemAlertsWidget, MemoizedShortcutsWidget, MemoizedFileExplorerWidget, MemoizedCalendarWidget, MemoizedActivityFeed, MemoizedQuickLaunchWidget, MemoizedTodoWidget, MemoizedHoloGlobe } from "@/components/jarvis/memoized-widgets";
import { CommandPalette, buildDefaultCommands } from "@/components/jarvis/command-palette";
import type { JarvisSettingsData } from "@/components/jarvis/settings-panel";
import { NotesPanel } from "@/components/jarvis/notes-panel";
import { AlertTriangle, Volume2, VolumeX, Shield, Radar, Eye, Brain, Globe, ImagePlus, Cpu, Ear, EarOff, FileText, Keyboard, Settings, Monitor, CloudSun, Music, Rocket, Activity, Target, Network, Bell, ShieldAlert, Mic, Search, BarChart3, Terminal, Headphones, FolderOpen, CalendarDays, FileCode, Bot, Puzzle, LayoutGrid, Command, Sparkles, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sounds";
import { showNotification, NotificationToastContainer } from "@/components/jarvis/notification-toast";
import { QuickActionsBar, type QuickAction } from "@/components/jarvis/quick-actions-bar";


const CAPABILITIES = [
  { icon: Brain, label: "Reasoning", desc: "LLM-диалог и анализ" },
  { icon: Volume2, label: "Voice I/O", desc: "Распознавание + синтез" },
  { icon: Eye, label: "Vision", desc: "Анализ изображений" },
  { icon: Monitor, label: "Screen", desc: "Захват экрана + VLM" },
  { icon: Rocket, label: "Launch", desc: "Быстрый доступ" },
  { icon: Target, label: "Focus", desc: "Pomodoro таймер" },
  { icon: CloudSun, label: "Weather", desc: "Погода в реальном" },
  { icon: Activity, label: "Events", desc: "Лог активности" },
  { icon: Network, label: "Network", desc: "Мониторинг трафика" },
  { icon: ShieldAlert, label: "Health", desc: "Мониторинг систем" },
  { icon: Bell, label: "Alerts", desc: "Уведомления HUD" },
  { icon: Terminal, label: "Processes", desc: "Монитор процессов" },
  { icon: Headphones, label: "Ambient", desc: "Фоновые звуки" },
  { icon: FolderOpen, label: "Files", desc: "Проводник файлов" },
  { icon: CalendarDays, label: "Calendar", desc: "Календарь + события" },
  { icon: FileCode, label: "Markdown", desc: "Редактор Markdown" },
  { icon: Command, label: "Voice CMD", desc: "Голосовые команды" },
  { icon: Bot, label: "Agent", desc: "Автономный ИИ-агент" },
  { icon: Puzzle, label: "Plugins", desc: "Система расширений" },
  { icon: LayoutGrid, label: "Layout", desc: "Настройка раскладки" },
  { icon: Search, label: "Search++", desc: "Глобальный поиск" },
  { icon: Bell, label: "Notif Center", desc: "Центр уведомлений" },
  { icon: Sparkles, label: "Insights", desc: "AI-анализ системы" },
  { icon: TrendingUp, label: "Metrics", desc: "История метрик" },
  { icon: Command, label: "DnD", desc: "Перетаскивание" },
];

export default function Home() {
  const [booted, setBooted] = useState(false);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [timerVisible, setTimerVisible] = useState(true);
  const [calcVisible, setCalcVisible] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [markdownOpen, setMarkdownOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [jarvisSettings, setJarvisSettings] = useState<JarvisSettingsData | null>(null);
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
  }, []);

  const jarvis = useJarvis({ autoSpeak: true, ttsRate: 1.05, ttsPitch: 0.92, settings: jarvisSettings ?? undefined });

  // Voice command NLP parser
  const { lastCommand, processText: processVoiceCommand } = useVoiceCommands({
    toggle_fullscreen: () => { void toggleFullscreen(); },
    new_chat: () => jarvis.newConversation(),
    toggle_notes: () => setNotesOpen((v) => !v),
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
      else if (w === "файлы" || w === "files") {} // scroll to file explorer
      else if (w === "календарь" || w === "calendar") {} // scroll to calendar
    },
    set_timer: (params: Record<string, string>) => {
      setTimerVisible(true);
      const secs = parseInt(params.seconds || "0", 10);
      if (secs > 0) timerRef.current?.startTimer(secs);
    },
    start_pomodoro: () => { /* TODO: trigger pomodoro */ },
    calculator: () => setCalcVisible((v) => !v),
  });

  const handleBootComplete = useCallback(() => {
    setBooted(true);
    showNotification({ title: "J.A.R.V.I.S. Online", message: "Все системы в норме. Ожидаю ваших указаний, сэр.", type: "success", duration: 5000 });
  }, []);

  // Set up command handlers for the hook
  useEffect(() => {
    const handlers: CommandHandlers = {
      startTimer: (seconds: number) => {
        setTimerVisible(true);
        timerRef.current?.startTimer(seconds);
      },
      stopTimer: () => timerRef.current?.stop(),
      resetTimer: () => timerRef.current?.reset(),
      toggleNotes: () => setNotesOpen((v) => !v),
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
      toggleCalculator: () => setCalcVisible((v) => !v),
      captureScreen: () => {
        if (jarvis.captureScreen) void jarvis.captureScreen();
      },
      openSettings: () => setSettingsOpen(true),
    };
    jarvis.setCommandHandlers(handlers);
  }, [jarvis.setCommandHandlers]);

  // System alerts → Activity Feed
  useSystemAlerts();

  // Global hotkeys
  useHotkeys({
    onToggleTimer: () => setTimerVisible((v) => !v),
    onToggleCalc: () => setCalcVisible((v) => !v),
    onToggleNotes: () => setNotesOpen((v) => !v),
    onOpenSettings: () => setSettingsOpen(true),
    onNewChat: () => jarvis.newChat(),
    onToggleVoice: () => jarvis.toggleRecording(),
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
      // Escape → stop speaking / close dialogs
      if (e.key === "Escape") {
        if (paletteOpen) {
          setPaletteOpen(false);
          return;
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          return;
        }
        if (notesOpen) {
          setNotesOpen(false);
          return;
        }
        if (markdownOpen) {
          setMarkdownOpen(false);
          return;
        }
        if (agentOpen) {
          setAgentOpen(false);
          return;
        }
        if (pluginOpen) {
          setPluginOpen(false);
          return;
        }
        if (layoutOpen) {
          setLayoutOpen(false);
          return;
        }
        if (notifOpen) {
          setNotifOpen(false);
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
  }, [jarvis, paletteOpen, settingsOpen, notesOpen, markdownOpen, agentOpen, pluginOpen, layoutOpen, notifOpen, searchOpen, toggleFullscreen]);

  // Build commands for palette
  const commands = buildDefaultCommands({
    newConversation: () => jarvis.newConversation(),
    toggleListening: () => jarvis.toggleListening(),
    toggleFullscreen,
    openSettings: () => {
      playSound("click");
      setSettingsOpen(true);
    },
    toggleNotes: () => setNotesOpen((v) => !v),
    toggleTimer: () => setTimerVisible((v) => !v),
    setTheme: (id: string) => {
      document.documentElement.setAttribute("data-theme", id);
      localStorage.setItem("jarvis-theme", id);
    },
    toggleCalculator: () => setCalcVisible((v) => !v),
    captureScreen: () => {
      if (jarvis.captureScreen) void jarvis.captureScreen();
    },
    toggleWakeWord: () => setWakeWordEnabled((v) => !v),
  });

  // Get active conversation title for export
  const activeTitle = jarvis.conversations.find(c => c.id === jarvis.activeConvoId)?.title;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
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
            className="flex min-h-screen flex-col"
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
                  onClick={() => setNotesOpen((v) => !v)}
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
                {/* Notification Bell */}
                <button
                  onClick={() => { playSound("click"); setNotifOpen((v) => !v); }}
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
                  {/* Quick Launch */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, duration: 0.5 }}
                  >
                    <MemoizedQuickLaunchWidget />
                  </motion.div>

                  <motion.div
                    className="jarvis-holo-glitch jarvis-crt-noise flex-shrink-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                  >
                    <MemoizedSystemMonitor />
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
                    <MemoizedActivityFeed />
                  </motion.div>

                  {/* System Alerts Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.33, duration: 0.5 }}
                  >
                    <MemoizedSystemAlertsWidget />
                  </motion.div>

                  {/* Holographic Globe */}
                  <motion.div
                    className="jarvis-box-glow jarvis-corner-brackets relative flex items-center justify-center overflow-hidden rounded-xl border jarvis-border-cyan bg-card/20 p-2 backdrop-blur-sm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.6 }}
                  >
                    <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
                    <MemoizedHoloGlobe size={220} />
                  </motion.div>

                  {/* Session Stats */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.36, duration: 0.5 }}
                  >
                    <MemoizedSessionStatsWidget />
                  </motion.div>

                  {/* Keyboard Shortcuts */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.37, duration: 0.5 }}
                  >
                    <MemoizedShortcutsWidget />
                  </motion.div>

                  {/* File Explorer */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.38, duration: 0.5 }}
                  >
                    <MemoizedFileExplorerWidget />
                  </motion.div>

                  {/* Calendar */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.39, duration: 0.5 }}
                  >
                    <MemoizedCalendarWidget />
                  </motion.div>
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

                  {/* Weather Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.5 }}
                  >
                    <MemoizedWeatherWidget />
                  </motion.div>

                  {/* World Clock */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.37, duration: 0.5 }}
                  >
                    <MemoizedWorldClockWidget />
                  </motion.div>

                  {/* Music Player */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.38, duration: 0.5 }}
                  >
                    <MemoizedMusicPlayer />
                  </motion.div>

                  {/* Clipboard Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.39, duration: 0.5 }}
                  >
                    <MemoizedClipboardWidget />
                  </motion.div>

                  {/* Network Traffic */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.395, duration: 0.5 }}
                  >
                    <MemoizedNetworkWidget />
                  </motion.div>

                  {/* Process Manager */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.41, duration: 0.5 }}
                  >
                    <MemoizedProcessManagerWidget />
                  </motion.div>

                  {/* Ambient Sound */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.415, duration: 0.5 }}
                  >
                    <MemoizedAmbientSoundWidget />
                  </motion.div>

                  {/* Pomodoro Focus */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.42, duration: 0.5 }}
                  >
                    <MemoizedPomodoroWidget />
                  </motion.div>

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

                  {/* TODO Widget */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                  >
                    <MemoizedTodoWidget onToggleNotes={() => setNotesOpen((v) => !v)} />
                  </motion.div>

                  {/* Directives */}
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
                        <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
                          Directives
                        </span>
                      </div>
                      <div className="space-y-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                        <div className="flex gap-2">
                          <span className="text-primary/60">01.</span>
                          <span>Голосовой ввод — нажмите микрофон и говорите.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">02.</span>
                          <span>Авто-озвучка + кнопка повтора для каждого ответа.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">03.</span>
                          <span>Веб-поиск автоматически для новостей, погоды, курсов.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">04.</span>
                          <span>Загрузите или перетащите изображение для анализа.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">05.</span>
                          <span>Генерация изображений — кнопки «Создай картинку» / «Арт».</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">06.</span>
                          <span>Смените костюм — переключатель тем Mark 1/42/50.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">07.</span>
                          <span>Экспорт диалогов — кнопка EXPORT в шапке чата.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">08.</span>
                          <span>Заметки, таймер, команды — Ctrl+K для палитры.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">09.</span>
                          <span>Say &quot;Hey Jarvis&quot; — wake word activation.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">10.</span>
                          <span>Screen Capture — покажите экран + задайте вопрос.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">11.</span>
                          <span>Weather + Music + Clipboard + World Clock.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">12.</span>
                          <span>Continuous Listen — Auto-Listen режим.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">13.</span>
                          <span>Quick Launch — быстрые ссылки по категориям.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">14.</span>
                          <span>Pomodoro Focus — режим концентрации 25/5.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">15.</span>
                          <span>Network Traffic — мониторинг сети в реальном времени.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">16.</span>
                          <span>System Health — пороговые алерты и диагностика.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">17.</span>
                          <span>HUD Notifications — всплывающие уведомления.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">18.</span>
                          <span>Enhanced Notes — категории, поиск, закрепление.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">19.</span>
                          <span>Code Highlighting — подсветка + копирование блоков.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">20.</span>
                          <span>Quick Actions Bar — быстрые действия внизу.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">21.</span>
                          <span>Session Stats — аналитика использования.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">22.</span>
                          <span>Keyboard Shortcuts — справка по хоткеям.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">23.</span>
                          <span>Process Monitor — список и завершение процессов.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">24.</span>
                          <span>Ambient Sound — атмосферные звуки (Web Audio).</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">25.</span>
                          <span>Image Drag &amp; Drop — перетащите фото в чат.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">26.</span>
                          <span>File Explorer — навигация по файловой системе.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">27.</span>
                          <span>Calendar — мини-календарь с событиями.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">28.</span>
                          <span>Markdown Editor — редактор с предпросмотром.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">29.</span>
                          <span>Unified Poller — оптимизация системных запросов.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">30.</span>
                          <span>Desktop Mode — Electron shell, tray, window controls.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">31.</span>
                          <span>Voice Commands — NLP-парсер для прямых команд.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">32.</span>
                          <span>AI Agent — автономный режим с пошаговым выполнением.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">33.</span>
                          <span>Plugin System — расширения и модули.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">34.</span>
                          <span>Layout Config — настройка раскладки и пресеты.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">35.</span>
                          <span>Notification Center — история и правила алертов.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">36.</span>
                          <span>Metrics History — график CPU/RAM/Network за 5 мин.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">37.</span>
                          <span>Widget DnD — перетаскивание виджетов (инфраструктура).</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">38.</span>
                          <span>Performance — React.memo + lazy loading оверлеев.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">39.</span>
                          <span>Accessibility — ARIA utils и focus trap.</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-primary/60">40.</span>
                          <span>Bugfix — Processes API locale, React key collision.</span>
                        </div>
                      </div>
                      <div className="mt-3 border-t jarvis-border-cyan pt-3">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                          Build
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-foreground/70">
                          JARVIS v13.0.0 · Stark Industries
                        </div>
                        <div className="font-mono text-[9px] text-muted-foreground/50">
                          Powered by Ollama local neural core
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </aside>
              </div>
            </main>

            {/* ===== Quick Actions Bar ===== */}
            <QuickActionsBar
              actions={[
                { icon: Mic, label: "Голос", onClick: () => jarvis.toggleListening() },
                { icon: Search, label: "Поиск", onClick: () => jarvis.sendText("Найди информацию о", "text") },
                { icon: Monitor, label: "Экран", onClick: () => { if (jarvis.captureScreen) void jarvis.captureScreen(); } },
                { icon: FileText, label: "Заметки", onClick: () => setNotesOpen((v: boolean) => !v) },
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