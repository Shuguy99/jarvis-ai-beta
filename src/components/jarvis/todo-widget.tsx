

import { useState, useEffect, useRef } from "react";
import { ListTodo, CheckCircle2 } from "lucide-react";

interface TodoWidgetProps {
  onToggleNotes: () => void;
}

export function TodoWidget({ onToggleNotes }: TodoWidgetProps) {
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);
  const mountedRef = useRef(true);

  const load = async () => {
    try {
      const res = await fetch("/api/jarvis/notes");
      const data = await res.json();
      const notes = data.notes ?? [];
      if (mountedRef.current) {
        setTotal(notes.length);
        setActive(notes.filter((n: { done: boolean }) => !n.done).length);
      }
    } catch {
      /* ignore */
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    mountedRef.current = true;
    void load();
    const interval = setInterval(() => void load(), 10000);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <button
      onClick={onToggleNotes}
      className="group w-full rounded-lg border jarvis-border-cyan bg-primary/5 p-3 transition hover:bg-primary/10 hover:jarvis-box-glow text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-primary/80 transition group-hover:text-primary" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/80">
            TODO
          </span>
        </div>
        {active > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/20 px-1.5 font-mono text-[9px] font-bold text-primary">
            {active}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 font-mono text-[9px]">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-400/70" />
          <span className="text-muted-foreground">
            {total - active}/{total}
          </span>
        </div>
        {total > 0 && (
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/30">
            <div
              className="h-full rounded-full bg-emerald-400/60 transition-all duration-500"
              style={{ width: `${total > 0 ? ((total - active) / total) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>
    </button>
  );
}