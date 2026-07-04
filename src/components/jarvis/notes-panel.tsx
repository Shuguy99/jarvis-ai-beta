

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Check,
  FileText,
  Search,
  Bookmark,
  BookmarkCheck,
  Pencil,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { playSound } from "@/lib/sounds";

// ── Types ──────────────────────────────────────────────

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  color: string;
  pinned: boolean;
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

interface NotesPanelProps {
  open: boolean;
  onClose: () => void;
}

// ── Constants ──────────────────────────────────────────

const CATEGORIES = [
  { key: "all", label: "Все" },
  { key: "general", label: "Общее" },
  { key: "ideas", label: "Идеи" },
  { key: "code", label: "Код" },
  { key: "tasks", label: "Задачи" },
  { key: "personal", label: "Личное" },
] as const;

const NOTE_COLORS = [
  { key: "cyan", class: "bg-cyan-400", border: "border-l-cyan-400/70" },
  { key: "emerald", class: "bg-emerald-400", border: "border-l-emerald-400/70" },
  { key: "amber", class: "bg-amber-400", border: "border-l-amber-400/70" },
  { key: "rose", class: "bg-rose-400", border: "border-l-rose-400/70" },
  { key: "violet", class: "bg-violet-400", border: "border-l-violet-400/70" },
  { key: "orange", class: "bg-orange-400", border: "border-l-orange-400/70" },
] as const;

// ── Helpers ────────────────────────────────────────────

function getColorBorder(colorKey: string): string {
  return NOTE_COLORS.find((c) => c.key === colorKey)?.border ?? "border-l-cyan-400/70";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "только что";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн назад`;
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
}

function getCategoryCounts(notes: Note[]): Record<string, number> {
  const counts: Record<string, number> = { all: notes.length };
  for (const n of notes) {
    counts[n.category] = (counts[n.category] ?? 0) + 1;
  }
  return counts;
}

// ── Component ──────────────────────────────────────────

export function NotesPanel({ open, onClose }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [editorCategory, setEditorCategory] = useState("general");
  const [editorColor, setEditorColor] = useState("cyan");
  const [editorPinned, setEditorPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Load notes ───────────────────────────────────
  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/notes");
      const data = await res.json();
      const loaded: Note[] = (data.notes ?? []).map((n: Record<string, unknown>) => ({
        id: n.id,
        title: n.title ?? "",
        content: n.content ?? "",
        category: n.category ?? "general",
        color: n.color ?? "cyan",
        pinned: n.pinned ?? false,
        done: n.done ?? false,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      }));
      setNotes(loaded);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadNotes();
    }
  }, [open, loadNotes]);

  // ── Auto-focus editor title when creating new note
  useEffect(() => {
    if (editingNote?.id === "__new__") {
      setTimeout(() => titleInputRef.current?.focus(), 80);
    }
  }, [editingNote?.id]);

  // ── Cancel edit ──────────────────────────────────
  const cancelEdit = useCallback(() => {
    setEditingNote(null);
    setEditorTitle("");
    setEditorContent("");
    setEditorCategory("general");
    setEditorColor("cyan");
    setEditorPinned(false);
  }, []);

  // ── Create new note ──────────────────────────────
  const startNewNote = useCallback(() => {
    if (editingNote) return;
    playSound("click");
    setEditingNote({
      id: "__new__",
      title: "",
      content: "",
      category: activeCategory === "all" ? "general" : activeCategory,
      color: "cyan",
      pinned: false,
      done: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setEditorTitle("");
    setEditorContent("");
    setEditorCategory(activeCategory === "all" ? "general" : activeCategory);
    setEditorColor("cyan");
    setEditorPinned(false);
  }, [editingNote, activeCategory]);

  // ── Save note (create or update) ─────────────────
  const saveNote = useCallback(async () => {
    const title = editorTitle.trim();
    const content = editorContent.trim();
    if (!title && !content) {
      cancelEdit();
      return;
    }

    setLoading(true);
    playSound("save");

    try {
      if (editingNote?.id === "__new__") {
        // Create
        const res = await fetch("/api/jarvis/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title || "Без названия",
            content,
            category: editorCategory,
            color: editorColor,
            pinned: editorPinned,
          }),
        });
        const data = await res.json();
        if (data.note) {
          const mapped: Note = {
            id: data.note.id,
            title: data.note.title,
            content: data.note.content,
            category: data.note.category ?? "general",
            color: data.note.color ?? "cyan",
            pinned: data.note.pinned ?? false,
            done: data.note.done ?? false,
            createdAt: data.note.createdAt,
            updatedAt: data.note.updatedAt,
          };
          setNotes((prev) => [mapped, ...prev]);
        }
      } else if (editingNote) {
        // Update
        const res = await fetch("/api/jarvis/notes", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingNote.id,
            title: title || "Без названия",
            content,
            category: editorCategory,
            color: editorColor,
            pinned: editorPinned,
          }),
        });
        const data = await res.json();
        if (data.note) {
          const mapped: Note = {
            id: data.note.id,
            title: data.note.title,
            content: data.note.content,
            category: data.note.category ?? "general",
            color: data.note.color ?? "cyan",
            pinned: data.note.pinned ?? false,
            done: data.note.done ?? false,
            createdAt: data.note.createdAt,
            updatedAt: data.note.updatedAt,
          };
          setNotes((prev) =>
            prev.map((n) => (n.id === mapped.id ? mapped : n))
          );
        }
      }
    } catch {
      /* ignore */
    }

    setLoading(false);
    cancelEdit();
  }, [editingNote, editorTitle, editorContent, editorCategory, editorColor, editorPinned, cancelEdit]);

  // ── Keyboard shortcuts (local to panel) ──────────
  useEffect(() => {
    if (!open || editingNote) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        e.stopPropagation();
        startNewNote();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, editingNote, startNewNote]);

  // ── Toggle done ──────────────────────────────────
  const toggleDone = useCallback(async (note: Note) => {
    try {
      const res = await fetch("/api/jarvis/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, done: !note.done }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id
              ? { ...n, done: data.note.done, updatedAt: data.note.updatedAt }
              : n
          )
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Toggle pin ───────────────────────────────────
  const togglePin = useCallback(async (note: Note) => {
    playSound("click");
    try {
      const res = await fetch("/api/jarvis/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
      });
      const data = await res.json();
      if (data.note) {
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id
              ? { ...n, pinned: data.note.pinned, updatedAt: data.note.updatedAt }
              : n
          )
        );
      }
    } catch {
      /* ignore */
    }
  }, []);

  // ── Delete note ──────────────────────────────────
  const deleteNote = useCallback(async (id: string) => {
    if (!confirm("Удалить заметку?")) return;
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

  // ── Edit existing note ───────────────────────────
  const startEdit = useCallback((note: Note) => {
    playSound("click");
    setEditingNote(note);
    setEditorTitle(note.title);
    setEditorContent(note.content);
    setEditorCategory(note.category);
    setEditorColor(note.color);
    setEditorPinned(note.pinned);
    setTimeout(() => titleInputRef.current?.focus(), 80);
  }, []);

  // ── Filtered + sorted notes ──────────────────────
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    // Category filter
    if (activeCategory !== "all") {
      result = result.filter((n) => n.category === activeCategory);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
      );
    }

    // Sort: pinned first, then by updatedAt desc
    result.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [notes, activeCategory, search]);

  const categoryCounts = useMemo(() => getCategoryCounts(notes), [notes]);

  // ── Editor keyboard handler ──────────────────────
  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        void saveNote();
      }
    },
    [saveNote, cancelEdit]
  );

  // ── Render ───────────────────────────────────────
  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="jarvis-box-glow jarvis-corner-brackets relative flex h-full flex-col overflow-hidden rounded-xl border jarvis-border-cyan bg-card/80 backdrop-blur-sm"
    >
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

      {/* Search */}
      <div className="relative border-b jarvis-border-cyan px-3 py-1.5">
        <div className="flex items-center gap-2 rounded border jarvis-border-cyan bg-background/30 px-2 py-1">
          <Search className="h-3 w-3 shrink-0 text-primary/50" />
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск заметок…"
            className="w-full bg-transparent font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
          {search && (
            <button
              onClick={() => {
                setSearch("");
                searchRef.current?.focus();
              }}
              className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition hover:text-primary"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="relative flex items-center gap-1 overflow-x-auto border-b jarvis-border-cyan px-2 py-1.5 jarvis-scroll">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          const count = categoryCounts[cat.key] ?? 0;
          return (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                playSound("click");
              }}
              className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] transition ${
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/30 text-muted-foreground hover:border-primary/20 hover:text-primary/70"
              }`}
            >
              {cat.label}
              <span className="ml-1 text-[9px] opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="relative flex-1 overflow-y-auto jarvis-scroll">
        <AnimatePresence mode="wait">
          {editingNote ? (
            /* ── Note Editor ─────────────────────── */
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col gap-2 p-3"
            >
              {/* Editor header */}
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-primary/70">
                  {editingNote.id === "__new__" ? "◆ Новая заметка" : "◆ Редактирование"}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={cancelEdit}
                    disabled={loading}
                    className="rounded border border-border/30 px-2 py-0.5 font-mono text-[9px] text-muted-foreground transition hover:text-primary"
                  >
                    ОТМЕНА
                  </button>
                  <button
                    onClick={() => void saveNote()}
                    disabled={loading || (!editorTitle.trim() && !editorContent.trim())}
                    className="rounded border jarvis-border-cyan px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-primary transition hover:bg-primary/10 disabled:opacity-30"
                  >
                    {loading ? "…" : "СОХРАНИТЬ"}
                  </button>
                </div>
              </div>

              {/* Title */}
              <input
                ref={titleInputRef}
                type="text"
                value={editorTitle}
                onChange={(e) => setEditorTitle(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder="Заголовок…"
                className="w-full rounded border jarvis-border-cyan bg-background/30 px-2 py-1.5 font-mono text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/30"
              />

              {/* Content */}
              <textarea
                value={editorContent}
                onChange={(e) => setEditorContent(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                placeholder="Содержание заметки… (Ctrl+Enter — сохранить)"
                rows={4}
                className="w-full resize-none rounded border jarvis-border-cyan bg-background/30 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-1 focus:ring-primary/30"
              />

              {/* Category pills (editor) */}
              <div className="flex items-center gap-1">
                <span className="mr-1 font-mono text-[9px] text-muted-foreground/60 shrink-0">
                  КАТЕГОРИЯ:
                </span>
                {CATEGORIES.filter((c) => c.key !== "all").map((cat) => {
                  const isActive = editorCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => setEditorCategory(cat.key)}
                      className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] transition ${
                        isActive
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/20 text-muted-foreground/60 hover:border-primary/20 hover:text-primary/60"
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Color picker + Pin toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted-foreground/60 shrink-0">
                    ЦВЕТ:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {NOTE_COLORS.map((c) => {
                      const isActive = editorColor === c.key;
                      return (
                        <button
                          key={c.key}
                          onClick={() => {
                            setEditorColor(c.key);
                            playSound("click");
                          }}
                          className={`h-3.5 w-3.5 rounded-full transition-transform ${c.class} ${
                            isActive
                              ? "scale-150 ring-1 ring-white/40"
                              : "opacity-50 hover:opacity-80"
                          }`}
                          title={c.key}
                        />
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setEditorPinned((p) => !p);
                    playSound("click");
                  }}
                  className={`flex items-center gap-1 rounded border px-2 py-0.5 font-mono text-[9px] transition ${
                    editorPinned
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/30 text-muted-foreground hover:border-primary/20 hover:text-primary/60"
                  }`}
                >
                  {editorPinned ? (
                    <BookmarkCheck className="h-3 w-3" />
                  ) : (
                    <Bookmark className="h-3 w-3" />
                  )}
                  ЗАКРЕПИТЬ
                </button>
              </div>

              {/* Hint */}
              <div className="font-mono text-[9px] text-muted-foreground/40">
                Ctrl+Enter — сохранить · Escape — отмена
              </div>
            </motion.div>
          ) : (
            /* ── Notes List ──────────────────────── */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {filteredNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8">
                  <FileText className="h-6 w-6 text-muted-foreground/30" />
                  <span className="font-mono text-[10px] text-muted-foreground/50">
                    {search
                      ? "Ничего не найдено"
                      : "Нет заметок"}
                  </span>
                  {!search && (
                    <span className="font-mono text-[9px] text-muted-foreground/30">
                      Ctrl+N — новая заметка
                    </span>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border/20">
                  <AnimatePresence>
                    {filteredNotes.map((note) => (
                      <motion.div
                        key={note.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12, height: 0, padding: 0, margin: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`group flex items-start gap-2 border-l-2 px-3 py-2 transition hover:bg-primary/5 ${
                          getColorBorder(note.color)
                        } ${
                          note.pinned
                            ? "bg-primary/5 border-primary/30"
                            : ""
                        }`}
                      >
                        {/* Done checkbox */}
                        <button
                          onClick={() => void toggleDone(note)}
                          className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition"
                          style={{
                            borderColor: note.done
                              ? "oklch(0.7 0.15 163)"
                              : "oklch(0.5 0.05 200)",
                            backgroundColor: note.done
                              ? "oklch(0.7 0.15 163 / 20%)"
                              : "transparent",
                          }}
                        >
                          {note.done && (
                            <Check
                              className="h-2.5 w-2.5"
                              style={{ color: "oklch(0.7 0.15 163)" }}
                            />
                          )}
                        </button>

                        {/* Note body */}
                        <div
                          className="min-w-0 flex-1 cursor-pointer"
                          onClick={() => startEdit(note)}
                        >
                          <div className="flex items-center gap-1.5">
                            {/* Pin indicator */}
                            {note.pinned && (
                              <BookmarkCheck className="h-2.5 w-2.5 shrink-0 text-primary/70" />
                            )}
                            <div
                              className={`font-mono text-[10px] leading-snug truncate ${
                                note.done
                                  ? "text-muted-foreground/50 line-through"
                                  : "text-foreground/90"
                              }`}
                            >
                              {note.title}
                            </div>
                          </div>
                          {note.content && (
                            <div
                              className={`mt-0.5 font-mono text-[9px] leading-snug line-clamp-2 ${
                                note.done
                                  ? "text-muted-foreground/30 line-through"
                                  : "text-muted-foreground/60"
                              }`}
                            >
                              {note.content}
                            </div>
                          )}
                          <div className="mt-1 flex items-center gap-2">
                            <span className="font-mono text-[8px] text-muted-foreground/40">
                              {relativeTime(note.updatedAt)}
                            </span>
                            <span className="font-mono text-[8px] text-muted-foreground/30">
                              {
                                CATEGORIES.find(
                                  (c) => c.key === note.category
                                )?.label ?? ""
                              }
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void togglePin(note);
                            }}
                            className={`flex h-5 w-5 items-center justify-center rounded transition ${
                              note.pinned
                                ? "text-primary/80 hover:text-primary"
                                : "text-muted-foreground/40 hover:text-primary/60"
                            }`}
                            title={note.pinned ? "Открепить" : "Закрепить"}
                          >
                            {note.pinned ? (
                              <BookmarkCheck className="h-3 w-3" />
                            ) : (
                              <Bookmark className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(note);
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition hover:text-primary/60"
                            title="Редактировать"
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteNote(note.id);
                            }}
                            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition hover:text-destructive"
                            title="Удалить"
                            style={{ color: undefined }}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* New note button */}
              {!editingNote && notes.length > 0 && (
                <div className="border-t border-border/20 p-2">
                  <button
                    onClick={startNewNote}
                    className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed jarvis-border-cyan/40 py-1.5 font-mono text-[10px] text-primary/50 transition hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                  >
                    <Plus className="h-3 w-3" />
                    Новая заметка
                    <span className="text-[8px] text-muted-foreground/30">Ctrl+N</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}