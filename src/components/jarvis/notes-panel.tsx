/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, Plus, Trash2, Check, FileText } from "lucide-react";
import { playSound } from "@/lib/sounds";

interface Note {
  id: string;
  title: string;
  content: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotesPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotesPanel({ open, onClose }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/notes");
      const data = await res.json();
      setNotes(data.notes ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadNotes();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, loadNotes]);

  const addNote = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || loading) return;
    setLoading(true);
    setInputValue("");
    playSound("click");

    try {
      const res = await fetch("/api/jarvis/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: text, content: text }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) => [data.note, ...prev]);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
    inputRef.current?.focus();
  }, [inputValue, loading]);

  const toggleDone = useCallback(async (note: Note) => {
    try {
      const res = await fetch("/api/jarvis/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, done: !note.done }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) => prev.map((n) => (n.id === note.id ? data.note : n)));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const deleteNote = useCallback(async (id: string) => {
    playSound("deactivate");
    try {
      await fetch("/api/jarvis/notes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch {
      /* ignore */
    }
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void addNote();
      }
    },
    [addNote]
  );

  if (!open) return null;

  return (
    <div className="jarvis-box-glow jarvis-corner-brackets relative flex h-full flex-col overflow-hidden rounded-xl border jarvis-border-cyan bg-card/80 backdrop-blur-sm">
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />

      {/* Header */}
      <div className="relative flex items-center justify-between border-b jarvis-border-cyan px-3 py-2">
        <div className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary jarvis-glow">
            Notes / Заметки
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            ({notes.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:text-primary"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Add input */}
      <div className="relative border-b jarvis-border-cyan px-3 py-2">
        <div className="flex items-center gap-2">
          <Plus className="h-3 w-3 shrink-0 text-primary/60" />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Новая заметка…"
            className="w-full bg-transparent font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none"
          />
          <button
            onClick={() => void addNote()}
            disabled={!inputValue.trim() || loading}
            className="shrink-0 rounded border jarvis-border-cyan px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary transition hover:bg-primary/10 disabled:opacity-30"
          >
            ADD
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="relative flex-1 overflow-y-auto jarvis-scroll">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <FileText className="h-6 w-6 text-muted-foreground/30" />
            <span className="font-mono text-[10px] text-muted-foreground/50">
              Нет заметок
            </span>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {notes.map((note) => (
              <div
                key={note.id}
                className="group flex items-start gap-2 px-3 py-2 transition hover:bg-primary/5"
              >
                <button
                  onClick={() => void toggleDone(note)}
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition"
                  style={{
                    borderColor: note.done ? "oklch(0.7 0.15 163)" : "oklch(0.5 0.05 200)",
                    backgroundColor: note.done ? "oklch(0.7 0.15 163 / 20%)" : "transparent",
                  }}
                >
                  {note.done && <Check className="h-2.5 w-2.5" style={{ color: "oklch(0.7 0.15 163)" }} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div
                    className={`font-mono text-[10px] leading-snug ${
                      note.done
                        ? "text-muted-foreground/50 line-through"
                        : "text-foreground/90"
                    }`}
                  >
                    {note.title}
                  </div>
                </div>
                <button
                  onClick={() => void deleteNote(note.id)}
                  className="mt-0.5 shrink-0 opacity-0 transition group-hover:opacity-100 hover:text-destructive"
                  style={{ color: "oklch(0.7 0.15 25)" }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}