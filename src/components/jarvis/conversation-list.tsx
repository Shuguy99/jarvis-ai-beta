"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Plus, MessageSquare, Trash2, Clock } from "lucide-react";
import type { Conversation } from "@/lib/types";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function relTime(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "только что";
  if (m < 60) return `${m}м назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ч назад`;
  const days = Math.floor(h / 24);
  return `${days}д назад`;
}

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: ConversationListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-primary/80 jarvis-glow">
          <Clock className="h-3 w-3" /> Session Log
        </span>
        <button
          onClick={onNew}
          className="flex items-center gap-1 rounded-md border jarvis-border-cyan bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:bg-primary/20"
        >
          <Plus className="h-3 w-3" /> New
        </button>
      </div>
      <div className="jarvis-scroll -mr-1 flex-1 space-y-1 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {conversations.length === 0 ? (
            <div className="px-2 py-6 text-center font-mono text-[10px] text-muted-foreground/60">
              Нет сохранённых сессий
            </div>
          ) : (
            conversations.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className={`group flex items-center gap-2 rounded-lg border px-2.5 py-2 transition ${
                  activeId === c.id
                    ? "border-primary/50 bg-primary/10 jarvis-box-glow"
                    : "border-transparent bg-card/40 hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <button
                  onClick={() => onSelect(c.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare
                    className={`h-3.5 w-3.5 flex-shrink-0 ${
                      activeId === c.id ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground/80">{c.title}</span>
                    <span className="block font-mono text-[9px] text-muted-foreground/70">
                      {relTime(c.updatedAt)} · {c.messages?.length ?? 0} сообщ.
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  className="flex-shrink-0 rounded p-1 text-muted-foreground/40 opacity-0 transition hover:text-destructive group-hover:opacity-100"
                  title="Удалить"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
