

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
// ReactMarkdown is lazy-loaded below via LazyMarkdown wrapper
import { Send, Square, Mic, MicOff, Volume2, ExternalLink, Search, User, Cpu, ImagePlus, Eye, Monitor, FileCode, FileText, SmilePlus, X, Zap } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";
import { playSound } from "@/lib/sounds";
import { getMarkdownComponents } from "@/components/jarvis/code-block";
import { generateConversationHTML, downloadHTML } from "@/lib/export-html";
import { generateChatPDF, printPDF } from "@/lib/export-pdf";
import { useJarvisStore } from "@/lib/jarvis-store";
import { getSuggestions, expandSuggestion } from "@/lib/suggestions";
import { useAgentLoop } from "@/hooks/use-agent-loop";
import { AgentStatusIndicator } from "@/components/jarvis/agent-status-indicator";
import { useVoice } from "@/hooks/use-voice";
import { VoiceIndicator } from "@/components/jarvis/voice-indicator";
import { useUIStore } from "@/lib/ui-store";
import { SpeechRecognitionService } from "@/lib/voice-stt";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const mdComponents = getMarkdownComponents();

// Lazy-load ReactMarkdown to keep it out of the main bundle
function LazyMarkdown({ children, components }: { children: string; components: ReturnType<typeof getMarkdownComponents> }) {
  const [Md, setMd] = useState<React.ComponentType<{ children: string; components: any }> | null>(null);
  useEffect(() => { import("react-markdown").then(mod => setMd(() => mod.default)); }, []);
  if (!Md) {
    return <span style={{ opacity: 0.7 }}>{children}</span>;
  }
  return <Md components={components}>{children}</Md>;
}

interface ChatPanelProps {
  jarvis: UseJarvisReturn;
}

/** TypewriterText v2 — cinematic character-by-character rendering with adaptive speed */
function TypewriterText({ text, speed = 25, onDone, onScroll }: { text: string; speed?: number; onDone?: () => void; onScroll?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const [cursorHiding, setCursorHiding] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const charCountRef = useRef(0);
  const onDoneRef = useRef(onDone);
  const onScrollRef = useRef(onScroll);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => { onScrollRef.current = onScroll; }, [onScroll]);

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    };
  }, []);

  // Brief glow on the last rendered character
  const triggerGlow = useCallback(() => {
    setGlowing(true);
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    glowTimerRef.current = setTimeout(() => setGlowing(false), 300);
  }, []);

  useEffect(() => {
    // Cleanup previous animation timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);

    charCountRef.current = 0;

    // ─── Very short text (< 40 chars): instant render with fade-in ───
    if (text.length < 40) {
      setDisplayed(text);
      setDone(true);
      setCursorHiding(true);
      onDoneRef.current?.();
      return;
    }

    // ─── Reset state for animation ───
    setDisplayed("");
    setDone(false);
    setCursorHiding(false);
    setGlowing(false);

    const PUNCT = new Set([".", ",", "!", "?", ";", ":", "—", "…"]);

    function punctDelay(ch: string): number {
      if (ch === "." || ch === "!" || ch === "?") return 150;
      if (ch === "," || ch === ";") return 100;
      if (ch === ":" || ch === "—" || ch === "…") return 120;
      return 0;
    }

    function adaptiveDelay(charIndex: number, base: number): number {
      if (charIndex < 100) return base;
      return Math.round(base * Math.max(0.4, 0.97 ** (charIndex - 100)));
    }

    /** Render a single character, fire side-effects, return delay before next step */
    function emitChar(pos: number, baseMs: number): number {
      charCountRef.current += 1;
      const cnt = charCountRef.current;

      setDisplayed(text.slice(0, pos + 1));
      triggerGlow();

      // Sound every 5th character
      if (cnt % 5 === 0) playSound("typewriter-tick");
      // Scroll every 3 characters
      if (cnt % 3 === 0) onScrollRef.current?.();

      const ch = text[pos];
      if (ch === "\n") return 200;
      if (ch === " ") return 15;

      let d = adaptiveDelay(cnt, baseMs);
      if (PUNCT.has(ch)) d += punctDelay(ch);
      return d;
    }

    function finish() {
      setDisplayed(text);
      setCursorHiding(true); // triggers CSS transition → fade out cursor over 500ms
      onDoneRef.current?.();
      // Switch to markdown render after cursor has faded
      timerRef.current = setTimeout(() => setDone(true), 500);
    }

    // ─── Character-by-character mode (< 200 chars) ───
    if (text.length < 200) {
      let i = 0;
      (function tick() {
        if (i >= text.length) { finish(); return; }
        const delay = emitChar(i, speed);
        i += 1;
        timerRef.current = setTimeout(tick, delay);
      })();
    }
    // ─── Word-by-word with inner char-by-char mode (200+ chars) ───
    else {
      let pos = 0;

      (function tickSegment() {
        if (pos >= text.length) { finish(); return; }

        // Whitespace run: render all at once
        if (/\s/.test(text[pos])) {
          const start = pos;
          while (pos < text.length && /\s/.test(text[pos])) pos++;
          charCountRef.current += pos - start;
          setDisplayed(text.slice(0, pos));
          if (charCountRef.current % 3 === 0) onScrollRef.current?.();

          const hasNewline = text.slice(start, pos).includes("\n");
          timerRef.current = setTimeout(tickSegment, hasNewline ? 200 : 15);
          return;
        }

        // Word: render character by character
        (function tickChar() {
          if (pos >= text.length || /\s/.test(text[pos])) {
            // Word complete — pause before next segment
            const lastCh = text[pos - 1];
            let pause = 40;
            if (lastCh && PUNCT.has(lastCh)) pause += punctDelay(lastCh);
            timerRef.current = setTimeout(tickSegment, pause);
            return;
          }
          const delay = emitChar(pos, 30);
          pos += 1;
          timerRef.current = setTimeout(tickChar, delay);
        })();
      })();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    };
  }, [text, speed, triggerGlow]);

  // ─── RENDER ───

  // Completed: full markdown
  if (done) {
    const md = (
      <LazyMarkdown components={mdComponents}>
        {text}
      </LazyMarkdown>
    );
    // Short text gets a fade-in wrapper
    if (text.length < 40) {
      return (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {md}
        </motion.span>
      );
    }
    return md;
  }

  // In progress: plain text (whitespace-pre-wrap) + glowing last char + blinking cursor
  const mainPart = displayed.length > 1 ? displayed.slice(0, -1) : "";
  const lastChar = displayed.length > 0 ? displayed.slice(-1) : "";

  return (
    <span className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
      {mainPart}
      {lastChar && (
        <span
          className={`transition-colors duration-300 ${
            glowing ? "text-primary/90" : "text-foreground/90"
          }`}
        >
          {lastChar}
        </span>
      )}
      <span
        className={`inline-block h-[1em] w-[2px] animate-pulse bg-primary ml-0.5 align-text-bottom rounded-sm transition-opacity duration-500 ${
          cursorHiding ? "opacity-0" : "opacity-100"
        }`}
      />
    </span>
  );
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🤔", "😮", "🔥"];

/** Inline reaction picker — appears on hover over assistant messages */
function ReactionPicker({ msgId, currentReactions }: { msgId: string; currentReactions?: string[] }) {
  const updateMessage = useJarvisStore((s) => s.updateMessage);

  const toggleReaction = (emoji: string) => {
    playSound("click");
    const existing = currentReactions ?? [];
    const next = existing.includes(emoji)
      ? existing.filter((e) => e !== emoji)
      : [...existing, emoji];
    updateMessage(msgId, { reactions: next.length ? next : undefined });
  };

  return (
    <div className="absolute -bottom-7 left-8 z-10 flex items-center gap-0.5 rounded-lg border jarvis-border-cyan bg-background/90 px-1.5 py-0.5 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover/msg:opacity-100">
      {REACTION_EMOJIS.map((emoji) => {
        const active = currentReactions?.includes(emoji);
        return (
          <button
            key={emoji}
            onClick={() => toggleReaction(emoji)}
            className={`rounded px-1 py-0.5 text-sm leading-none transition hover:scale-125 ${
              active ? "bg-primary/20 ring-1 ring-primary/40" : "hover:bg-primary/10"
            }`}
          >
            {emoji}
          </button>
        );
      })}
      <SmilePlus className="ml-0.5 h-3 w-3 text-muted-foreground/50" />
    </div>
  );
}

function MessageBubble({ msg, onSpeak, isLatest, onScroll }: { msg: ChatMessage; onSpeak: (t: string) => void; isLatest?: boolean; onScroll?: () => void }) {
  const isUser = msg.role === "user";
  const isTypewriterTarget = !isUser && !msg.pending && !msg.streaming && !!msg.content && isLatest;
  const isStreaming = !isUser && msg.streaming && !!msg.content;
  const handleTwDone = useCallback(() => { playSound("message-receive"); }, []);

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 anim-fade-up">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm border jarvis-border-cyan bg-primary/10 px-3.5 py-2.5 backdrop-blur-sm">
          {(msg.source === "voice") && (
            <div className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-primary/70">
              <Mic className="h-2.5 w-2.5" /> voice
            </div>
          )}
          {(msg.source === "image") && (
            <div className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-primary/70">
              <Eye className="h-2.5 w-2.5" /> vision analysis
            </div>
          )}
          {msg.imageAttachments && msg.imageAttachments.length > 0 && (
            <div className="mb-2 flex gap-2">
              {msg.imageAttachments.map(img => (
                <img key={img.id} src={img.dataUrl} className="max-h-40 rounded-lg border border-primary/20" alt={img.name} />
              ))}
            </div>
          )}
          {msg.imagePreview && (
            <div className="mb-2 overflow-hidden rounded-lg border jarvis-border-cyan">
              <img src={msg.imagePreview} alt="Загруженное" className="max-h-48 w-auto rounded-lg object-contain" />
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{msg.content}</p>
        </div>
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border jarvis-border-cyan bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex justify-start gap-2 anim-fade-up group/msg pb-6">
      <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border jarvis-border-cyan bg-primary/15 jarvis-box-glow">
        <Cpu className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="max-w-[82%] rounded-2xl rounded-tl-sm border jarvis-border-cyan bg-card/70 px-3.5 py-2.5 backdrop-blur-sm jarvis-corner-brackets">
        {msg.pending ? (
          <div className="flex items-center gap-1.5 py-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70">processing</span>
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </span>
          </div>
        ) : isStreaming ? (
          <>
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-code:text-primary prose-code:before:hidden prose-code:after:hidden prose-code:rounded prose-code:bg-primary/10 prose-code:px-1 prose-pre:bg-transparent prose-pre:p-0 prose-a:text-primary">
              <LazyMarkdown components={mdComponents}>
                {msg.content}
              </LazyMarkdown>
            </div>
            <span className="inline-block h-[1em] w-[2px] animate-pulse bg-primary/90 ml-0.5 align-text-bottom rounded-sm" />
          </>
        ) : (
          <>
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-code:text-primary prose-code:before:hidden prose-code:after:hidden prose-code:rounded prose-code:bg-primary/10 prose-code:px-1 prose-pre:bg-transparent prose-pre:p-0 prose-a:text-primary">
              {isTypewriterTarget ? (
                <TypewriterText text={msg.content} speed={25} onDone={handleTwDone} onScroll={onScroll} />
              ) : (
                <LazyMarkdown components={mdComponents}>
                  {msg.content}
                </LazyMarkdown>
              )}
            </div>
            {/* Generated image display */}
            {msg.generatedImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="mt-2 overflow-hidden rounded-lg border jarvis-border-cyan"
              >
                <img
                  src={msg.generatedImage}
                  alt="Сгенерированное изображение"
                  className="max-h-80 w-auto rounded-lg object-contain"
                />
                <div className="flex items-center gap-1.5 px-2 py-1.5 font-mono text-[9px] text-muted-foreground/60">
                  <ImagePlus className="h-2.5 w-2.5" /> AI Generated
                </div>
              </motion.div>
            )}
            {msg.hasAudio && !isTypewriterTarget && (
              <button
                onClick={() => { playSound("click"); onSpeak(msg.content); }}
                className="mt-1.5 flex items-center gap-1 rounded-md border jarvis-border-cyan px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary/80 transition hover:bg-primary/10 hover:jarvis-box-glow"
              >
                <Volume2 className="h-2.5 w-2.5" /> replay audio
              </button>
            )}
            {/* Mood emoji */}
            {msg.moodEmoji && (
              <span className="ml-1 inline-block text-xs opacity-70">{msg.moodEmoji}</span>
            )}
            {/* Active reactions */}
            {msg.reactions && msg.reactions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-0.5">
                {msg.reactions.map((r) => (
                  <span key={r} className="rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-xs">
                    {r}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {/* Reaction picker (only for finalized assistant messages) */}
      {!msg.pending && !msg.streaming && (
        <ReactionPicker msgId={msg.id} currentReactions={msg.reactions} />
      )}
    </div>
  );
}

export function ChatPanel({ jarvis }: ChatPanelProps) {
  const { messages, sendText, state, searchedSources, stopSpeaking } = jarvis;
  const [input, setInput] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [screenCaptureOpen, setScreenCaptureOpen] = useState(false);
  const [screenPrompt, setScreenPrompt] = useState("");
  const [agentMode, setAgentMode] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);
  const lastSpokenMsgIdRef = useRef<string | null>(null);

  // ─── Voice Pipeline ───
  const voiceEnabled = useUIStore((s) => s.voiceEnabled);
  const voice = useVoice({
    onTranscriptFinal: (text) => {
      if (text.trim()) {
        void sendText(text.trim(), "voice");
      }
    },
  });

  // Auto-speak latest assistant message when voice pipeline is enabled
  useEffect(() => {
    if (!voiceEnabled) return;
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || lastMsg.pending || lastMsg.streaming) return;
    if (lastSpokenMsgIdRef.current === lastMsg.id) return;
    if (!lastMsg.content.trim()) return;
    lastSpokenMsgIdRef.current = lastMsg.id;
    voice.speakResponse(lastMsg.content);
  }, [messages, voiceEnabled, voice.speakResponse]);

  const handleVoiceToggle = useCallback(() => {
    if (voice.state !== "idle") {
      playSound("deactivate");
      voice.stopVoice();
    } else {
      if (!SpeechRecognitionService.isSupported()) return;
      playSound("mic-on");
      voice.startVoice();
    }
  }, [voice]);

  // Agent loop hook
  const agent = useAgentLoop();

  const handleAutoScroll = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    handleAutoScroll();
  }, [messages, handleAutoScroll]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if ((!text && !pendingImage) || state === "thinking" || state === "speaking" || agent.isRunning) return;

      if (agentMode && text && !pendingImage) {
        // Agent mode: use agent loop instead of regular chat
        setPendingImage(null);
        setInput("");
        playSound("message-send");
        agent.startAgent(text);
        return;
      }

      const imageData = pendingImage?.dataUrl;
      setPendingImage(null);
      setInput("");
      playSound("message-send");
      void sendText(text || "Проанализируй это изображение", "text", imageData);
    },
    [input, state, sendText, pendingImage, agentMode, agent.isRunning, agent.startAgent]
  );

  const busy = state === "thinking" || state === "speaking" || agent.isRunning;
  const suggestions = getSuggestions(
    messages.filter(m => m.role === "assistant").pop()?.content ?? null,
    messages.length
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !IMAGE_TYPES.includes(file.type)) return;
      playSound("activate");
      void readFileAsDataUrl(file).then((dataUrl) => {
        setPendingImage({ dataUrl, name: file.name });
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [readFileAsDataUrl]
  );

  /* ─── Drag & Drop handlers ─── */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only activate for image files
    const item = e.dataTransfer.items?.[0];
    if (item && IMAGE_TYPES.includes(item.type)) {
      dragCounterRef.current += 1;
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file && IMAGE_TYPES.includes(file.type)) {
        playSound("activate");
        void readFileAsDataUrl(file).then((dataUrl) => {
          setPendingImage({ dataUrl, name: file.name });
        });
      }
    },
    [readFileAsDataUrl]
  );

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Messages */}
      <div
        ref={scrollRef}
        className="jarvis-scroll relative flex-1 space-y-4 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-primary/60 anim-pulse-glow">
              Awaiting your command, sir
            </div>
            <p className="max-w-xs font-mono text-[11px] leading-relaxed text-muted-foreground">
              Напишите сообщение, нажмите кнопку микрофона, или перетащите изображение для анализа.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <MessageBubble key={m.id} msg={m} onSpeak={jarvis.speak} isLatest={i === messages.length - 1 && m.role === "assistant"} onScroll={handleAutoScroll} />
            ))}
          </AnimatePresence>
        )}

        {/* Sources */}
        {searchedSources && searchedSources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border jarvis-border-cyan bg-primary/5 p-2.5"
          >
            <div className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-primary/80">
              <Search className="h-3 w-3" /> Web Sources
            </div>
            <div className="space-y-1">
              {searchedSources.slice(0, 4).map((s, i) => (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-muted-foreground transition hover:text-primary hover:bg-primary/5"
                >
                  <span className="font-mono text-primary/60">[{i + 1}]</span>
                  <span className="truncate">{s.name}</span>
                  <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-50" />
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Agent Status Indicator */}
      <AgentStatusIndicator
        status={agent.status}
        currentTool={agent.currentTool}
        iterations={agent.iterations}
        log={agent.log}
        error={agent.error}
        onCancel={agent.stopAgent}
      />

      {/* Quick Suggestions */}
      <AnimatePresence>
        {messages.length > 0 && !busy && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="flex gap-1.5 overflow-x-auto px-4 py-2 scrollbar-none"
          >
            {suggestions.slice(0, 4).map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  playSound("click");
                  const expanded = expandSuggestion(s);
                  void sendText(expanded, "text");
                }}
                className="flex flex-shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-[10px] text-primary/80 transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              >
                <span>{s.icon}</span>
                <span>{s.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Drop Zone Overlay ─── */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm jarvis-box-glow"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="rounded-full border border-primary/30 bg-primary/10 p-4">
                <ImagePlus className="h-10 w-10 text-primary anim-pulse-glow" />
              </div>
              <span className="font-mono text-sm uppercase tracking-widest text-primary jarvis-glow">
                Перетащите изображение для прикрепления
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                PNG, JPEG, GIF, WebP — JARVIS проанализирует содержимое
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="relative border-t jarvis-border-cyan p-3"
      >
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => { playSound("click"); fileInputRef.current?.click(); }}
            disabled={busy}
            className="flex md:h-[44px] md:w-[44px] h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border jarvis-border-cyan bg-card/60 text-primary/80 transition hover:bg-primary/15 hover:text-primary hover:jarvis-box-glow disabled:cursor-not-allowed disabled:opacity-40"
            title="Загрузить изображение для анализа"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
          {jarvis.captureScreen && (
            <button
              type="button"
              onClick={() => { playSound("activate"); setScreenCaptureOpen(true); }}
              disabled={busy}
              className="flex md:h-[44px] md:w-[44px] h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border jarvis-border-cyan bg-card/60 text-primary/80 transition hover:bg-primary/15 hover:text-primary hover:jarvis-box-glow disabled:cursor-not-allowed disabled:opacity-40"
              title="Показать экран Джарвису"
            >
              <Monitor className="h-4 w-4" />
            </button>
          )}
          {/* Voice Pipeline Mic Button */}
          {voiceEnabled && (
            <button
              type="button"
              onClick={handleVoiceToggle}
              disabled={busy || !voice.isSupported}
              className={`flex md:h-[44px] md:w-[44px] h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                voice.state !== "idle"
                  ? "border-primary bg-primary/20 text-primary jarvis-box-glow"
                  : "border-jarvis-border-cyan bg-card/60 text-primary/80 hover:bg-primary/15 hover:text-primary hover:jarvis-box-glow"
              }`}
              title={
                !voice.isSupported
                  ? "Voice not supported in this browser"
                  : voice.state !== "idle"
                    ? "Остановить голосовой ввод"
                    : "Голосовой ввод (Voice Pipeline)"
              }
            >
              {voice.state !== "idle" ? (
                <MicOff className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
          )}
          {/* Voice Indicator (shown when voice pipeline is active) */}
          <AnimatePresence>
            {voice.state !== "idle" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <VoiceIndicator
                  state={voice.state}
                  volume={voice.volume}
                  waveformData={voice.waveformData}
                  size={44}
                />
                <div className="flex flex-col">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-primary/80">
                    {voice.state === "listening"
                      ? "Listening…"
                      : voice.state === "processing"
                        ? "Processing…"
                        : "Speaking…"}
                  </span>
                  {voice.transcript && voice.isListening && (
                    <span className="max-w-[120px] truncate font-mono text-[9px] text-muted-foreground/60">
                      {voice.transcript}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="relative flex-1">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder="Введите команду для J.A.R.V.I.S.…"
              className="jarvis-scroll max-h-32 min-h-[48px] w-full resize-none rounded-lg border jarvis-border-cyan bg-card/60 px-3 py-2.5 pr-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:jarvis-box-glow"
              disabled={state === "thinking"}
            />
          </div>
          {busy ? (
            <button
              type="button"
              onClick={() => { playSound("click"); stopSpeaking(); }}
              className="flex md:h-[44px] md:w-[44px] h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/15 text-destructive transition hover:bg-destructive/25"
              title="Остановить"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <>
              {/* Agent Mode Toggle */}
              <button
                type="button"
                onClick={() => {
                  playSound(agentMode ? "deactivate" : "activate");
                  setAgentMode((v) => !v);
                }}
                className={`flex md:h-[44px] md:w-[44px] h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border transition ${
                  agentMode
                    ? "border-primary bg-primary/20 text-primary jarvis-box-glow"
                    : "border-muted-foreground/20 bg-card/60 text-muted-foreground/60 hover:border-primary/30 hover:text-primary/80 hover:bg-primary/10"
                }`}
                title={agentMode ? "Agent Mode ON — click to disable" : "Agent Mode — click to enable"}
              >
                <Zap className={`h-4 w-4 ${agentMode ? "animate-pulse" : ""}`} />
              </button>
              <button
                type="submit"
                disabled={!input.trim() && !pendingImage}
                className="flex md:h-[44px] md:w-[44px] h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border jarvis-border-cyan bg-primary/15 text-primary transition hover:bg-primary/25 hover:jarvis-box-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary/15"
                title="Отправить"
              >
                <Send className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
        {/* Превью прикреплённого изображения */}
        <AnimatePresence>
          {pendingImage && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 overflow-hidden mt-1">
              <img src={pendingImage.dataUrl} className="h-12 w-12 rounded border border-primary/30 object-cover" alt={pendingImage.name} />
              <span className="font-mono text-[10px] text-muted-foreground truncate">{pendingImage.name}</span>
              <button type="button" onClick={() => { playSound("deactivate"); setPendingImage(null); }} className="ml-auto rounded-md p-1 text-muted-foreground transition hover:text-destructive"><X className="h-3 w-3" /></button>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Screen Capture Modal */}
        <AnimatePresence>
          {screenCaptureOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-primary/30 bg-background/90 backdrop-blur-md"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="mx-4 w-full max-w-md rounded-xl border jarvis-border-cyan bg-card/90 p-5 shadow-2xl"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary anim-pulse-glow" />
                  <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
                    Screen Analysis
                  </span>
                </div>
                <p className="mb-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  JARVIS захватит текущий экран и проанализирует его через систему компьютерного зрения.
                </p>
                <div className="mb-4">
                  <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Вопрос (опционально)
                  </label>
                  <textarea
                    value={screenPrompt}
                    onChange={(e) => setScreenPrompt(e.target.value)}
                    placeholder="Например: найди ошибки на странице, опиши открытые вкладки…"
                    rows={3}
                    autoFocus
                    className="jarvis-scroll w-full resize-none rounded-lg border jarvis-border-cyan bg-background/60 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { playSound("deactivate"); setScreenCaptureOpen(false); setScreenPrompt(""); }}
                    className="rounded-lg border jarvis-border-cyan bg-card/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      setScreenCaptureOpen(false);
                      const prompt = screenPrompt;
                      setScreenPrompt("");
                      void jarvis.captureScreen!(prompt || undefined);
                    }}
                    className="rounded-lg border jarvis-border-cyan bg-primary/20 px-4 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:bg-primary/30 hover:jarvis-box-glow"
                  >
                    Захватить
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            Enter — отправить · Shift+Enter — перенос · Drag & Drop — прикрепить изображение
          </span>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <>
              <button
                type="button"
                onClick={() => {
                  playSound("success");
                  const title = "Chat Export";
                  const html = generateConversationHTML({ title, messages, model: "local", provider: "JARVIS" });
                  downloadHTML(html, `jarvis-chat-${Date.now()}.html`);
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 transition hover:text-primary hover:bg-primary/10"
                title="Экспортировать как HTML"
              >
                <FileCode className="h-2.5 w-2.5" />
                <span>HTML</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playSound("success");
                  const html = generateChatPDF(messages);
                  printPDF(html);
                }}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 transition hover:text-primary hover:bg-primary/10"
                title="Экспортировать как PDF"
              >
                <FileText className="h-2.5 w-2.5" />
                <span>PDF</span>
              </button>
              </>
            )}
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
              {messages.length} сообщ.
            </span>
          </div>
        </div>
        <div className="mt-0.5 flex justify-center px-1">
          <span className="font-mono text-[10px] text-muted-foreground/40">
            Удерживайте Space для голосового ввода
          </span>
        </div>
      </form>
    </div>
  );
}