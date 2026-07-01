"use client";

import { useJarvis } from "@/hooks/use-jarvis";
import { ArcReactor } from "@/components/jarvis/arc-reactor";
import { SystemMonitor } from "@/components/jarvis/system-monitor";
import { ChatPanel } from "@/components/jarvis/chat-panel";
import { QuickCommands } from "@/components/jarvis/quick-commands";
import { ConversationList } from "@/components/jarvis/conversation-list";
import { VoiceControl } from "@/components/jarvis/voice-control";
import { StatusClock } from "@/components/jarvis/status-clock";
import { AlertTriangle, Volume2, VolumeX, Shield, Radar, Eye, Brain, Globe } from "lucide-react";
import { motion } from "framer-motion";

const CAPABILITIES = [
  { icon: Brain, label: "Reasoning", desc: "LLM-диалог и анализ" },
  { icon: Volume2, label: "Voice I/O", desc: "Распознавание + синтез" },
  { icon: Globe, label: "Web Search", desc: "Актуальные данные" },
  { icon: Eye, label: "Vision", desc: "Анализ изображений" },
  { icon: Radar, label: "Diagnostics", desc: "Мониторинг систем" },
  { icon: Shield, label: "Secure", desc: "Локальная история" },
];

export default function Home() {
  const jarvis = useJarvis({ autoSpeak: true });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ===== Header ===== */}
      <header className="relative z-10 flex items-center justify-between border-b jarvis-border-cyan bg-card/40 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-50" />
        <div className="relative flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center">
            <svg viewBox="0 0 40 40" className="absolute inset-0 anim-spin-slow">
              <circle cx="20" cy="20" r="18" fill="none" stroke="oklch(0.82 0.17 193 / 40%)" strokeWidth="1" strokeDasharray="4 4" />
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

        <div className="relative flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 sm:flex">
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
          <StatusClock />
        </div>
      </header>

      {/* ===== Main ===== */}
      <main className="relative flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
        <div className="relative mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-3 p-3 lg:grid-cols-12 lg:gap-4 lg:p-4">
          {/* Left sidebar */}
          <aside className="flex flex-col gap-3 lg:col-span-3 lg:max-h-full lg:overflow-hidden">
            <div className="flex-shrink-0">
              <SystemMonitor />
            </div>
            <div className="jarvis-box-glow min-h-[200px] flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-3 backdrop-blur-sm lg:min-h-0">
              <ConversationList
                conversations={jarvis.conversations}
                activeId={jarvis.activeConvoId}
                onSelect={jarvis.selectConversation}
                onNew={jarvis.newConversation}
                onDelete={jarvis.deleteConversation}
              />
            </div>
          </aside>

          {/* Center column */}
          <section className="flex flex-col gap-3 lg:col-span-6 lg:max-h-full lg:overflow-hidden">
            {/* Hero: arc reactor + voice + quick commands */}
            <div className="jarvis-box-glow relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm">
              <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
              <div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 flex-col items-center gap-2">
                  <ArcReactor state={jarvis.state} audioLevel={jarvis.audioLevel} size={200} />
                  <div className="mt-4 flex items-center gap-2">
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
                      <p className="text-center font-mono text-[11px] leading-relaxed text-muted-foreground">
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
                <QuickCommands onPick={(p) => jarvis.sendText(p, "text")} />
              </div>
            </div>

            {/* Chat */}
            <div className="jarvis-box-glow relative flex min-h-[340px] flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 backdrop-blur-sm lg:min-h-0">
              <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-40" />
              <div className="relative flex w-full flex-col">
                <div className="flex items-center justify-between border-b jarvis-border-cyan px-4 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary/80 jarvis-glow">
                    Dialogue Interface
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {jarvis.messages.length} messages
                  </span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ChatPanel jarvis={jarvis} />
                </div>
              </div>
            </div>
          </section>

          {/* Right sidebar */}
          <aside className="flex flex-col gap-3 lg:col-span-3 lg:max-h-full lg:overflow-hidden">
            <div className="jarvis-box-glow rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <Radar className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
                  Capabilities
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CAPABILITIES.map((c) => (
                  <div
                    key={c.label}
                    className="rounded-lg border jarvis-border-cyan bg-primary/5 p-2.5 transition hover:bg-primary/10"
                  >
                    <c.icon className="mb-1 h-4 w-4 text-primary/80" />
                    <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
                      {c.label}
                    </div>
                    <div className="font-mono text-[9px] text-muted-foreground">{c.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="jarvis-box-glow flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
                  Directives
                </span>
              </div>
              <div className="space-y-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
                <div className="flex gap-2">
                  <span className="text-primary/60">01.</span>
                  <span>Голосовой ввод — нажмите микрофон и говорите. Повторное нажатие останавливает запись.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary/60">02.</span>
                  <span>Авто-озвучка ответов включается/выключается в шапке. Каждое сообщение можно прослушать повторно.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary/60">03.</span>
                  <span>Запросы о новостях, погоде, курсах автоматически запускают веб-поиск.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary/60">04.</span>
                  <span>Все диалоги сохраняются локально и доступны в журнале сессий.</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-primary/60">05.</span>
                  <span>Быстрые команды — мгновенный доступ к типовым задачам.</span>
                </div>
              </div>
              <div className="mt-3 border-t jarvis-border-cyan pt-3">
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                  Build
                </div>
                <div className="mt-1 font-mono text-[10px] text-foreground/70">
                  JARVIS v2.7.1 · Stark Industries
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/50">
                  Powered by Z.ai neural core
                </div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 mt-auto border-t jarvis-border-cyan bg-card/40 px-4 py-2 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
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
    </div>
  );
}
