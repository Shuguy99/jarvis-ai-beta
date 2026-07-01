"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Square, Mic, Volume2, ExternalLink, Search, User, Cpu } from "lucide-react";
import type { ChatMessage } from "@/lib/types";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";

interface ChatPanelProps {
  jarvis: UseJarvisReturn;
}

function MessageBubble({ msg, onSpeak }: { msg: ChatMessage; onSpeak: (t: string) => void }) {
  const isUser = msg.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end gap-2 anim-fade-up">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm border jarvis-border-cyan bg-primary/10 px-3.5 py-2.5">
          {msg.source === "voice" && (
            <div className="mb-1 flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-primary/70">
              <Mic className="h-2.5 w-2.5" /> voice
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
      <div className="max-w-[82%] rounded-2xl rounded-tl-sm border jarvis-border-cyan bg-card/70 px-3.5 py-2.5 backdrop-blur-sm">
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
        ) : (
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
            {msg.hasAudio && (
              <button
                onClick={() => onSpeak(msg.content)}
                className="mt-1.5 flex items-center gap-1 rounded-md border jarvis-border-cyan px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary/80 transition hover:bg-primary/10"
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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || state === "thinking" || state === "speaking") return;
      setInput("");
      void sendText(text, "text");
    },
    [input, state, sendText]
  );

  const busy = state === "thinking" || state === "speaking";

  return (
    <div className="flex h-full flex-col">
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
              Напишите сообщение или нажмите кнопку микрофона, чтобы начать голосовой диалог с J.A.R.V.I.S.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onSpeak={jarvis.speak} />
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

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="relative border-t jarvis-border-cyan p-3"
      >
        <div className="flex items-end gap-2">
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
              onClick={stopSpeaking}
              className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-lg border border-destructive/40 bg-destructive/15 text-destructive transition hover:bg-destructive/25"
              title="Остановить"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-[44px] w-[44px] flex-shrink-0 items-center justify-center rounded-lg border jarvis-border-cyan bg-primary/15 text-primary transition hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary/15"
              title="Отправить"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            Enter — отправить · Shift+Enter — перенос
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            {messages.length} сообщ.
          </span>
        </div>
      </form>
    </div>
  );
}
