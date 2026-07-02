"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Square, Mic, Volume2, ExternalLink, Search, User, Cpu, ImagePlus, Eye, Upload } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";
import { playSound } from "@/lib/sounds";

interface ChatPanelProps {
  jarvis: UseJarvisReturn;
}

/** Typewriter component — renders text with word-by-word typewriter effect */
function TypewriterText({ text, speed = 40, onDone, onScroll }: { text: string; speed?: number; onDone?: () => void; onScroll?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  const onScrollRef = useRef(onScroll);

  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => { onScrollRef.current = onScroll; }, [onScroll]);

  useEffect(() => {
    // Skip typewriter for short messages — render immediately
    if (text.length < 30) {
      setDisplayed(text);
      setDone(true);
      onDoneRef.current?.();
      return;
    }

    const words = text.split(" ");
    let idx = 0;
    setDisplayed("");
    setDone(false);

    function tick() {
      if (idx >= words.length) {
        setDisplayed(text);
        setDone(true);
        onDoneRef.current?.();
        return;
      }

      const currentWord = words[idx];
      const prevText = idx === 0 ? "" : words.slice(0, idx).join(" ") + " ";
      setDisplayed(prevText + currentWord);

      // Play typewriter tick sound every 3rd word
      if ((idx + 1) % 3 === 0) {
        playSound("typewriter-tick");
      }

      // Scroll sync callback
      onScrollRef.current?.();

      // Calculate adaptive delay
      let delay = speed;

      // Short words (1-2 chars) type faster
      if (currentWord.length <= 2) {
        delay = 20;
      }

      // Punctuation marks add a pause
      if (/[.,!?;:]$/.test(currentWord)) {
        delay += 100;
      }

      // Long paragraphs: gradually speed up after the first 10 words
      if (idx >= 10) {
        const speedupFactor = Math.max(0.5, 1 - (idx - 10) * 0.03);
        delay = Math.round(delay * speedupFactor);
      }

      idx += 1;
      timerRef.current = setTimeout(tick, delay);
    }

    tick();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, speed]);

  return (
    <>
      <ReactMarkdown
        components={{
          a: ({ ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
        }}
      >
        {displayed}
      </ReactMarkdown>
      {!done && (
        <span className="inline-block h-[1em] w-[2px] animate-pulse bg-primary/90 ml-0.5 align-text-bottom rounded-sm" />
      )}
    </>
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
    <div className="flex justify-start gap-2 anim-fade-up">
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
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-code:text-primary prose-code:before:hidden prose-code:after:hidden prose-code:rounded prose-code:bg-primary/10 prose-code:px-1 prose-pre:bg-muted/50 prose-a:text-primary">
              <ReactMarkdown
                components={{
                  a: ({ ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
            <span className="inline-block h-[1em] w-[2px] animate-pulse bg-primary/90 ml-0.5 align-text-bottom rounded-sm" />
          </>
        ) : (
          <>
            <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-code:text-primary prose-code:before:hidden prose-code:after:hidden prose-code:rounded prose-code:bg-primary/10 prose-code:px-1 prose-pre:bg-muted/50 prose-a:text-primary">
              {isTypewriterTarget ? (
                <TypewriterText text={msg.content} speed={40} onDone={handleTwDone} onScroll={onScroll} />
              ) : (
                <ReactMarkdown
                  components={{
                    a: ({ ...props }) => <a target="_blank" rel="noreferrer" {...props} />,
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
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
          </>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({ jarvis }: ChatPanelProps) {
  const { messages, sendText, state, searchedSources, stopSpeaking } = jarvis;
  const [input, setInput] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragCounterRef = useRef(0);

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
      if (!text || state === "thinking" || state === "speaking") return;
      setInput("");
      playSound("message-send");
      void sendText(text, "text");
    },
    [input, state, sendText]
  );

  const busy = state === "thinking" || state === "speaking";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      playSound("activate");
      void jarvis.analyzeImage(file, input.trim() || undefined);
      setInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [jarvis, input]
  );

  /* ─── Drag & Drop handlers ─── */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    // Only show drop zone if dragging files
    if (e.dataTransfer.types.includes("Files")) {
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
      if (file && file.type.startsWith("image/")) {
        playSound("activate");
        void jarvis.analyzeImage(file, input.trim() || undefined);
        setInput("");
      }
    },
    [jarvis, input]
  );

  return (
    <div
      className="flex h-full flex-col"
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

      {/* ─── Drop Zone Overlay ─── */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-primary anim-pulse-glow" />
              <span className="font-mono text-xs uppercase tracking-widest text-primary">
                Drop image here
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                JARVIS will analyze the image
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
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />
          <button
            type="button"
            onClick={() => { playSound("click"); fileInputRef.current?.click(); }}
            disabled={busy}
            className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-lg border jarvis-border-cyan bg-card/60 text-primary/80 transition hover:bg-primary/15 hover:text-primary hover:jarvis-box-glow disabled:cursor-not-allowed disabled:opacity-40"
            title="Загрузить изображение для анализа"
          >
            <ImagePlus className="h-4 w-4" />
          </button>
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
              className="jarvis-scroll max-h-32 min-h-[44px] w-full resize-none rounded-lg border jarvis-border-cyan bg-card/60 px-3 py-2.5 pr-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:jarvis-box-glow"
              disabled={state === "thinking"}
            />
          </div>
          {busy ? (
            <button
              type="button"
              onClick={() => { playSound("click"); stopSpeaking(); }}
              className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/15 text-destructive transition hover:bg-destructive/25"
              title="Остановить"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-lg border jarvis-border-cyan bg-primary/15 text-primary transition hover:bg-primary/25 hover:jarvis-box-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary/15"
              title="Отправить"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            Enter — отправить · Shift+Enter — перенос · Drag & Drop — изображение
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            {messages.length} сообщ.
          </span>
        </div>
      </form>
    </div>
  );
}