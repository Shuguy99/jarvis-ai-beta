

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { FileCode, Bold, Italic, Code2, Link, X } from "lucide-react";
import { playSound } from "@/lib/sounds";
import { getMarkdownComponents } from "@/components/jarvis/code-block";

const STORAGE_KEY = "jarvis-markdown-content";
const mdComponents = getMarkdownComponents();

type Mode = "edit" | "preview";

// Lazy-loaded ReactMarkdown wrapper — only loads when preview mode is activated
function LazyMarkdown({ children, components }: { children: string; components: ReturnType<typeof getMarkdownComponents> }) {
  const [Md, setMd] = useState<React.ComponentType<{ children: string; components: any }> | null>(null);

  useEffect(() => {
    import("react-markdown").then(mod => setMd(() => mod.default));
  }, []);

  if (!Md) {
    return <p className="text-muted-foreground/50 font-mono text-[11px]">Loading preview…</p>;
  }

  return <Md components={components}>{children}</Md>;
}

const TOOLBAR_BUTTONS = [
  { icon: Bold, label: "B", before: "**", after: "**", placeholder: "жирный" },
  { icon: Italic, label: "I", before: "*", after: "*", placeholder: "курсив" },
  { icon: Code2, label: "</>", before: "`", after: "`", placeholder: "код" },
  { icon: Link, label: "🔗", before: "[", after: "](url)", placeholder: "ссылка" },
] as const;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

interface MarkdownWidgetProps {
  onClose?: () => void;
}

export function MarkdownWidget({ onClose }: MarkdownWidgetProps) {
  const [mode, setMode] = useState<Mode>("edit");
  const [content, setContent] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, content);
    } catch {
      /* ignore */
    }
  }, [content]);

  const toggleMode = useCallback((newMode: Mode) => {
    if (newMode === mode) return;
    playSound("click", 0.2);
    setMode(newMode);
  }, [mode]);

  const insertSyntax = useCallback((before: string, after: string, placeholder: string) => {
    playSound("click", 0.2);
    const ta = textareaRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const newContent = content.slice(0, start) + before + selected + after + content.slice(end);
    setContent(newContent);

    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      ta.focus();
      const cursorPos = start + before.length;
      ta.setSelectionRange(
        content.slice(start, end) ? cursorPos + selected.length : cursorPos,
        content.slice(start, end) ? cursorPos + selected.length : cursorPos + selected.length
      );
      if (!content.slice(start, end)) {
        ta.setSelectionRange(cursorPos, cursorPos + selected.length);
      }
    });
  }, [content]);

  const charCount = content.length;
  const wordCount = countWords(content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative jarvis-box-glow jarvis-corner-brackets jarvis-grid-bg backdrop-blur-sm bg-card/40 border jarvis-border-cyan rounded-xl min-h-[300px] flex flex-col"
    >
      <div className="jarvis-corner-brackets-inner" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-3.5 w-3.5 text-primary jarvis-glow" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            Markdown
          </span>
        </div>

        {/* Mode toggle + Close */}
        <div className="flex items-center gap-1">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              onClick={() => toggleMode(m)}
              className={
                "font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md border transition-colors " +
                (mode === m
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-primary/10 bg-transparent text-muted-foreground hover:text-foreground hover:border-primary/25")
              }
            >
              {m === "edit" ? "Edit" : "Preview"}
            </button>
          ))}
          {onClose && (
            <button onClick={() => { playSound("click", 0.2); onClose(); }} className="ml-1 flex h-6 w-6 items-center justify-center rounded-md border border-muted-foreground/20 text-muted-foreground transition hover:border-destructive/40 hover:text-destructive" aria-label="Закрыть">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar (edit mode only) */}
      {mode === "edit" && (
        <div className="flex items-center gap-1 px-4 pb-2">
          {TOOLBAR_BUTTONS.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.label}
                onClick={() => insertSyntax(btn.before, btn.after, btn.placeholder)}
                className="flex items-center justify-center h-7 w-7 rounded-md border border-primary/10 bg-muted/20 text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary hover:bg-primary/10"
                title={btn.label}
                aria-label={btn.label}
              >
                <Icon className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 px-4 pb-2 min-h-0">
        {mode === "edit" ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Введите Markdown..."
            spellCheck={false}
            className="w-full h-full bg-background/60 border border-primary/10 rounded-lg p-3 font-mono text-[11px] text-foreground resize-none focus:outline-none focus:border-primary/30 jarvis-scroll leading-relaxed"
          />
        ) : (
          <div className="w-full h-full overflow-auto jarvis-scroll bg-background/60 border border-primary/10 rounded-lg p-3 prose prose-invert prose-sm max-w-none">
            {content.trim() ? (
              <LazyMarkdown components={mdComponents}>
                {content}
              </LazyMarkdown>
            ) : (
              <p className="text-muted-foreground/50 font-mono text-[11px]">
                Нет содержимого для предпросмотра
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="font-mono text-[9px] text-muted-foreground">
          {charCount} симв · {wordCount} слов
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/50">
          auto-saved
        </span>
      </div>
    </motion.div>
  );
}