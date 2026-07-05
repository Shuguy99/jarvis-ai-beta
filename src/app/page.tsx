

// JARVIS HUD — оркестратор
// Все визуальные секции вынесены в:
//   jarvis-header, jarvis-left-sidebar, jarvis-right-sidebar,
//   jarvis-footer, jarvis-overlays
// Токены ~2.5k, время монтирования ~10ms

import { useCallback, useRef, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Search, Monitor, FileText, FileCode, Bot, Puzzle, LayoutGrid, Settings, AlertTriangle, Moon, EyeOff, BarChart3, Menu, LayoutDashboard } from "lucide-react";

import { useJarvis, type CommandHandlers } from "@/hooks/use-jarvis";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useWakeWord } from "@/hooks/use-wake-word";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { useSystemAlerts } from "@/hooks/use-system-alerts";
import { useProactiveEngine } from "@/hooks/use-proactive-engine";
import { useVoiceCommands } from "@/hooks/use-voice-commands";
import { publishSystemMetrics } from "@/lib/context-bus";
import { useUIStore } from "@/lib/ui-store";
import { playSound } from "@/lib/sounds";
import { showNotification } from "@/components/jarvis/notification-toast";

import { ArcReactor } from "@/components/jarvis/arc-reactor";
import { ChatPanel } from "@/components/jarvis/chat-panel";
import { QuickCommands } from "@/components/jarvis/quick-commands";
import { VoiceControl } from "@/components/jarvis/voice-control";
import { NewsTicker } from "@/components/jarvis/news-ticker";
import { JarvisParticles } from "@/components/jarvis/particles";
import { ConversationExport } from "@/components/jarvis/conversation-export";
import { PrivacyWizard } from "@/components/jarvis/privacy-wizard";
import { QuickActionsBar, type QuickAction } from "@/components/jarvis/quick-actions-bar";
import { buildDefaultCommands } from "@/components/jarvis/command-palette";
import type { TimerHandle } from "@/components/jarvis/timer-widget";

import { JarvisOverlays } from "@/components/jarvis/jarvis-overlays";
import { JarvisHeader } from "@/components/jarvis/jarvis-header";
import { JarvisLeftSidebar } from "@/components/jarvis/jarvis-left-sidebar";
import { JarvisRightSidebar } from "@/components/jarvis/jarvis-right-sidebar";
import { JarvisFooter } from "@/components/jarvis/jarvis-footer";

export default function Home() {
  // ── Zustand state (fine-grained selectors) ──
  const booted = useUIStore((s) => s.booted);
  const wakeWordEnabled = useUIStore((s) => s.wakeWordEnabled);
  const jarvisSettings = useUIStore((s) => s.jarvisSettings);

  const setBooted = useUIStore(s => s.setBooted);
  const setWakeWordEnabled = useUIStore(s => s.setWakeWordEnabled);
  const toggleNotes = useUIStore(s => s.toggleNotes);
  const setNotesOpen = useUIStore(s => s.setNotesOpen);
  const setTimerVisible = useUIStore(s => s.setTimerVisible);
  const toggleTimer = useUIStore(s => s.toggleTimer);
  const setCalcVisible = useUIStore(s => s.setCalcVisible);
  const toggleCalc = useUIStore(s => s.toggleCalc);
  const setPaletteOpen = useUIStore(s => s.setPaletteOpen);
  const setSettingsOpen = useUIStore(s => s.setSettingsOpen);
  const setMarkdownOpen = useUIStore(s => s.setMarkdownOpen);
  const setAgentOpen = useUIStore(s => s.setAgentOpen);
  const setPluginOpen = useUIStore(s => s.setPluginOpen);
  const setLayoutOpen = useUIStore(s => s.setLayoutOpen);
  const setAnalyticsOpen = useUIStore(s => s.setAnalyticsOpen);
  const setBriefingOpen = useUIStore(s => s.setBriefingOpen);
  const closeAllPanels = useUIStore(s => s.closeAllPanels);
  const setJarvisSettings = useUIStore(s => s.setJarvisSettings);

  const { isMobile, leftOpen, rightOpen, toggleLeft, toggleRight, closeAll } = useMobileSidebar();
  const timerRef = useRef<TimerHandle>(null);
  const briefingShownRef = useRef(false);
  const [pushToTalkActive, setPushToTalkActive] = useState(false);

  // Load behavior settings from DB on mount
  useEffect(() => {
    fetch("/api/jarvis/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings) {
          const s = data.settings;
          setJarvisSettings({
            ttsRate: parseFloat(s.ttsRate) || 1.05, ttsPitch: parseFloat(s.ttsPitch) || 0.95,
            volume: parseFloat(s.volume) ?? 1.0, autoSpeak: s.autoSpeak !== "false",
            language: s.language || "ru", persona: s.persona || "classic", userName: s.userName || "",
            formality: parseFloat(s.formality) || 0.7, humor: parseFloat(s.humor) || 0.4,
            responseStyle: s.responseStyle || "standard", temperature: parseFloat(s.temperature) || 0.7,
            maxTokens: parseInt(s.maxTokens, 10) || 2048, contextWindow: parseInt(s.contextWindow, 10) || 20,
            customPrompt: s.customPrompt || "",
          });
        }
      }).catch(() => { /* use defaults */ });
  }, [setJarvisSettings]);

  const jarvis = useJarvis({ autoSpeak: true, ttsRate: 1.05, ttsPitch: 0.92, settings: jarvisSettings ?? undefined });

  // Fullscreen toggle helper (used by voice commands & hotkeys)
  const toggleFullscreen = useCallback(async () => {
    playSound("activate");
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
  }, []);

  // Voice command NLP parser
  const { lastCommand } = useVoiceCommands({
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
      else if (w === "статистика" || w === "analytics") setAnalyticsOpen(true);
      else if (w === "сводка" || w === "briefing") setBriefingOpen(true);
    },
    set_timer: (params: Record<string, string>) => {
      setTimerVisible(true);
      const secs = parseInt(params.seconds || "0", 10);
      if (secs > 0) timerRef.current?.startTimer(secs);
    },
    calculator: () => toggleCalc(),
  }, { speak: (text: string) => jarvis.speak(text) });

  const handleBootComplete = useCallback(() => {
    setBooted(true);
    showNotification({ title: "J.A.R.V.I.S. Online", message: "Все системы в норме. Ожидаю ваших указаний, сэр.", type: "success" });
    // Show daily briefing once per session, after a short delay
    if (!briefingShownRef.current) {
      briefingShownRef.current = true;
      setTimeout(() => setBriefingOpen(true), 600);
    }
  }, [setBooted, setBriefingOpen]);

  // Set up command handlers for the hook
  useEffect(() => {
    const handlers: CommandHandlers = {
      startTimer: (seconds: number) => { setTimerVisible(true); timerRef.current?.startTimer(seconds); },
      stopTimer: () => timerRef.current?.stop(),
      resetTimer: () => timerRef.current?.reset(),
      toggleNotes: () => toggleNotes(), openNotes: () => setNotesOpen(true),
      toggleFullscreen: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* ignore */ } },
      setTheme: (id: string) => { document.documentElement.setAttribute("data-theme", id); localStorage.setItem("jarvis-theme", id); },
      toggleCalculator: () => toggleCalc(),
      captureScreen: () => { if (jarvis.captureScreen) void jarvis.captureScreen(); },
      openSettings: () => setSettingsOpen(true),
    };
    jarvis.setCommandHandlers(handlers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jarvis.setCommandHandlers, jarvis.captureScreen, setNotesOpen, setSettingsOpen, setTimerVisible, toggleCalc, toggleNotes]);

  useSystemAlerts();
  useProactiveEngine({ enabled: true, voiceAlerts: true });

  // Context Bus — publish system metrics
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/jarvis/system", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        publishSystemMetrics({ cpuLoad: data.cpuLoad ?? 0, memPct: data.memPct ?? 0, diskPct: data.diskPct ?? 0, temp: data.temp ?? 0, netSpeedIn: data.netSpeedIn ?? 0, netSpeedOut: data.netSpeedOut ?? 0 });
      } catch { /* ignore */ }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  useHotkeys({
    onToggleTimer: () => toggleTimer(), onToggleCalc: () => toggleCalc(), onToggleNotes: () => toggleNotes(),
    onOpenSettings: () => setSettingsOpen(true), onNewChat: () => jarvis.newConversation(),
    onToggleVoice: () => jarvis.toggleListening(),
    onToggleFullscreen: async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* ignore */ } },
    onOpenPalette: () => setPaletteOpen(true),
    onToggleQuietMode: () => useUIStore.getState().toggleQuietMode(),
    onToggleIncognitoMode: () => {
      const wasActive = useUIStore.getState().incognitoMode;
      useUIStore.getState().toggleIncognitoMode();
      if (wasActive) showNotification({ title: "Инкогнито отключён", type: "info" });
    },
  });

  // Push-to-talk: hold Space to record, release to send
  usePushToTalk({
    onHold: () => {
      if (!jarvis.isRecording) {
        setPushToTalkActive(true);
        jarvis.startListening();
      }
    },
    onRelease: () => {
      setPushToTalkActive(false);
      if (jarvis.isRecording) jarvis.stopListening();
    },
  });

  const handleWakeWord = useCallback(() => { jarvis.startListening(); }, [jarvis]);
  const { isListening: isWakeListening } = useWakeWord({ enabled: wakeWordEnabled, onWakeWord: handleWakeWord });

  // Global keyboard shortcuts
  const paletteOpen = useUIStore((s) => s.paletteOpen);
  const settingsOpen = useUIStore((s) => s.settingsOpen);
  const notesOpen = useUIStore((s) => s.notesOpen);
  const markdownOpen = useUIStore((s) => s.markdownOpen);
  const agentOpen = useUIStore((s) => s.agentOpen);
  const pluginOpen = useUIStore((s) => s.pluginOpen);
  const layoutOpen = useUIStore((s) => s.layoutOpen);
  const notifOpen = useUIStore((s) => s.notifOpen);
  const analyticsOpen = useUIStore((s) => s.analyticsOpen);
  const briefingOpen = useUIStore((s) => s.briefingOpen);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); setPaletteOpen((v) => !v); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "m") { e.preventDefault(); jarvis.toggleListening(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") { e.preventDefault(); jarvis.newConversation(); return; }
      if (e.key === "Escape") {
        if (paletteOpen || settingsOpen || notesOpen || markdownOpen || agentOpen || pluginOpen || layoutOpen || notifOpen || analyticsOpen || briefingOpen) { closeAllPanels(); return; }
        if (jarvis.state === "speaking") { jarvis.stopSpeaking(); return; }
      }
      if (e.key === "F11") { e.preventDefault(); void toggleFullscreen(); return; }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jarvis, closeAllPanels, paletteOpen, settingsOpen, notesOpen, markdownOpen, agentOpen, pluginOpen, layoutOpen, notifOpen, analyticsOpen, briefingOpen, toggleFullscreen, setPaletteOpen]);

  // Build commands for palette
  const commands = useMemo(
    () => buildDefaultCommands({
      newConversation: () => jarvis.newConversation(), toggleListening: () => jarvis.toggleListening(), toggleFullscreen,
      openSettings: () => { playSound("click"); setSettingsOpen(true); }, toggleNotes: () => toggleNotes(), toggleTimer: () => toggleTimer(),
      setTheme: (id: string) => { document.documentElement.setAttribute("data-theme", id); localStorage.setItem("jarvis-theme", id); },
      toggleCalculator: () => toggleCalc(), captureScreen: () => { if (jarvis.captureScreen) void jarvis.captureScreen(); },
      toggleWakeWord: () => setWakeWordEnabled((v: boolean) => !v),
      toggleQuietMode: () => useUIStore.getState().toggleQuietMode(),
      toggleIncognitoMode: () => useUIStore.getState().toggleIncognitoMode(),
      openAnalytics: () => { playSound("click"); setAnalyticsOpen(true); },
      openBriefing: () => { playSound("click"); setBriefingOpen(true); },
    }),
    [toggleFullscreen, toggleNotes, toggleTimer, toggleCalc, setSettingsOpen, setWakeWordEnabled, setAnalyticsOpen, setBriefingOpen, jarvis.newConversation, jarvis.toggleListening, jarvis.captureScreen]
  );

  const activeTitle = jarvis.conversations.find((c) => c.id === jarvis.activeConvoId)?.title;

  return (
    <div className="jarvis-desktop-no-scroll jarvis-no-select jarvis-smooth-resize flex min-h-screen flex-col bg-background text-foreground">
      <PrivacyWizard />
      <JarvisOverlays jarvis={jarvis} commands={commands} lastCommand={lastCommand} onBootComplete={handleBootComplete} />

      <AnimatePresence>
        {booted && (
          <motion.div className="jarvis-no-select flex min-h-screen flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: "easeOut" }}>
            <NewsTicker />
            <JarvisHeader jarvis={jarvis} isWakeListening={isWakeListening} />
            {isMobile && (
              <>
                <button onClick={toggleLeft} className="md:hidden jarvis-touch-target flex items-center justify-center rounded-lg border border-primary/20 bg-card/60 text-primary">
                  <Menu className="h-5 w-5" />
                </button>
                <button onClick={toggleRight} className="md:hidden jarvis-touch-target flex items-center justify-center rounded-lg border border-primary/20 bg-card/60 text-primary">
                  <LayoutDashboard className="h-5 w-5" />
                </button>
              </>
            )}

            <main className="relative flex-1 overflow-hidden">
              <JarvisParticles count={40} />
              <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
              <div className="relative mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-3 p-3 md:grid-cols-12 md:gap-4 md:p-4">
                <JarvisLeftSidebar jarvis={jarvis} className={leftOpen ? "sidebar-open" : ""} />

                {/* Center column */}
                <section className="jarvis-chat-main flex flex-col gap-3 lg:col-span-6 lg:max-h-[calc(100vh-12rem)] lg:overflow-hidden">
                  <motion.div className="jarvis-box-glow jarvis-hologram jarvis-noise relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}>
                    <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
                    <div className="pointer-events-none absolute inset-0 jarvis-data-stream opacity-30" />
                    <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-1 flex-col items-center gap-2">
                        <ArcReactor state={jarvis.state} audioLevel={jarvis.audioLevel} size={180} />
                        <div className="mt-2 flex items-center gap-2">
                          {jarvis.error ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 font-mono text-[10px] text-destructive">
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
                      <div className="flex flex-col items-center sm:items-end"><VoiceControl jarvis={jarvis} pushToTalkActive={pushToTalkActive} /></div>
                    </div>
                    <div className="relative mt-4 border-t jarvis-border-cyan pt-3">
                      <QuickCommands onPick={(p) => jarvis.sendText(p, "text")} onImageGen={(p) => jarvis.generateImage(p)} />
                    </div>
                  </motion.div>

                  <motion.div className="jarvis-holo-glitch jarvis-box-glow jarvis-gradient-border jarvis-data-stream-v2 jarvis-border-pulse relative flex min-h-[340px] flex-1 overflow-hidden rounded-xl bg-card/40 backdrop-blur-sm lg:min-h-0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
                    <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-40" />
                    <div className="relative flex w-full flex-col">
                      <div className="flex items-center justify-between border-b jarvis-border-cyan px-4 py-2">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80 jarvis-glow">Dialogue Interface</span>
                        <div className="flex items-center gap-3">
                          {jarvis.messages.length > 0 && <ConversationExport messages={jarvis.messages} conversationTitle={activeTitle} />}
                          <span className="font-mono text-[10px] text-muted-foreground">{jarvis.messages.length} messages</span>
                        </div>
                      </div>
                      <div className="flex-1 overflow-hidden"><ChatPanel jarvis={jarvis} /></div>
                    </div>
                  </motion.div>
                </section>

                <JarvisRightSidebar jarvis={jarvis} timerRef={timerRef} className={rightOpen ? "sidebar-open" : ""} />
              </div>
              {isMobile && (leftOpen || rightOpen) && (
                <div className="sidebar-backdrop" onClick={closeAll} />
              )}
            </main>

            <QuickActionsBar actions={[
              { icon: Mic, label: "Голос", onClick: () => jarvis.toggleListening() },
              { icon: Search, label: "Поиск", onClick: () => jarvis.sendText("Найди информацию о", "text") },
              { icon: Monitor, label: "Экран", onClick: () => { if (jarvis.captureScreen) void jarvis.captureScreen(); } },
              { icon: FileText, label: "Заметки", onClick: () => toggleNotes() },
              { icon: FileCode, label: "Markdown", onClick: () => setMarkdownOpen((v: boolean) => !v) },
              { icon: Bot, label: "Агент", onClick: () => setAgentOpen((v: boolean) => !v) },
              { icon: Puzzle, label: "Плагины", onClick: () => setPluginOpen((v: boolean) => !v) },
              { icon: LayoutGrid, label: "Раскладка", onClick: () => setLayoutOpen((v: boolean) => !v) },
              { icon: Moon, label: "Не беспокоить", onClick: () => useUIStore.getState().toggleQuietMode() },
              { icon: EyeOff, label: "Инкогнито", onClick: () => useUIStore.getState().toggleIncognitoMode() },
              { icon: BarChart3, label: "Статистика", onClick: () => { playSound("click"); setAnalyticsOpen(true); } },
              { icon: Settings, label: "Настройки", onClick: () => { playSound("click"); setSettingsOpen(true); } },
            ] as QuickAction[]} />

            <JarvisFooter />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}