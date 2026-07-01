"use client";

import { useState, useCallback } from "react";
import { useJarvis } from "@/hooks/use-jarvis";
import { ArcReactor } from "@/components/jarvis/arc-reactor";
import { SystemMonitor } from "@/components/jarvis/system-monitor";
import { ChatPanel } from "@/components/jarvis/chat-panel";
import { QuickCommands } from "@/components/jarvis/quick-commands";
import { ConversationList } from "@/components/jarvis/conversation-list";
import { VoiceControl } from "@/components/jarvis/voice-control";
import { StatusClock } from "@/components/jarvis/status-clock";
import { BootSequence } from "@/components/jarvis/boot-sequence";
import { HoloGlobe } from "@/components/jarvis/holo-globe";
import { NewsTicker } from "@/components/jarvis/news-ticker";
import { FullscreenToggle } from "@/components/jarvis/fullscreen-toggle";
import { ThemeSwitcher } from "@/components/jarvis/theme-switcher";
import { ConversationExport } from "@/components/jarvis/conversation-export";
import { AlertTriangle, Volume2, VolumeX, Shield, Radar, Eye, Brain, Globe, ImagePlus, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CAPABILITIES = [
  { icon: Brain, label: "Reasoning", desc: "LLM-диалог и анализ" },
  { icon: Volume2, label: "Voice I/O", desc: "Распознавание + синтез" },
  { icon: Globe, label: "Web Search", desc: "Актуальные данные" },
  { icon: Eye, label: "Vision", desc: "Анализ изображений" },
  { icon: ImagePlus, label: "Image Gen", desc: "Генерация картинок" },
  { icon: Radar, label: "Diagnostics", desc: "Мониторинг систем" },
  { icon: Shield, label: "Secure", desc: "Локальная история" },
  { icon: Cpu, label: "Processing", desc: "Нейроядро v5" },
];

export default function Home() {
  const [booted, setBooted] = useState(false);
  const jarvis = useJarvis({ autoSpeak: true, ttsRate: 1.05, ttsPitch: 0.92 });

  const handleBootComplete = useCallback(() => setBooted(true), []);

  // Get active conversation title for export
  const activeTitle = jarvis.conversations.find(c => c.id === jarvis.activeConvoId)?.title;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ===== Boot Sequence Overlay ===== */}
      <BootSequence onComplete={handleBootComplete} />

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
            <header className="relative z-10 flex items-center justify-between border-b jarvis-border-cyan bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6">
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
                <ThemeSwitcher />
                <FullscreenToggle />
                <StatusClock />
              </div>
            </header>

            {/* ===== Main ===== */}
            <main className="relative flex-1 overflow-hidden">
              {/* Floating particles layer */}
              <div className="pointer-events-none absolute inset-0 jarvis-particles opacity-60" />
              <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

              <div className="relative mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:gap-4 lg:p-4">
                {/* Left sidebar */}
                <aside className="flex flex-col gap-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-hidden">
                  <motion.div
                    className="flex-shrink-0"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                  >
                    <SystemMonitor />
                  </motion.div>
                  {/* Holographic Globe */}
                  <motion.div
                    className="jarvis-box-glow jarvis-corner-brackets relative flex items-center justify-center overflow-hidden rounded-xl border jarvis-border-cyan bg-card/20 p-2 backdrop-blur-sm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.35, duration: 0.6 }}
                  >
                    <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
                    <HoloGlobe size={220} />
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
                    className="jarvis-box-glow jarvis-gradient-border relative flex min-h-[340px] flex-1 overflow-hidden rounded-xl bg-card/40 backdrop-blur-sm lg:min-h-0"
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
                <aside className="flex flex-col gap-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-hidden">
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

                  <motion.div
                    className="jarvis-box-glow jarvis-corner-brackets relative flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
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
                          <span>Загрузите изображение — Джарвис проанализирует его.</span>
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
                          <span>Диалоги сохраняются локально в базе данных.</span>
                        </div>
                      </div>
                      <div className="mt-3 border-t jarvis-border-cyan pt-3">
                        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                          Build
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-foreground/70">
                          JARVIS v5.0.0 · Stark Industries
                        </div>
                        <div className="font-mono text-[9px] text-muted-foreground/50">
                          Powered by Z.ai neural core
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </aside>
              </div>
            </main>

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