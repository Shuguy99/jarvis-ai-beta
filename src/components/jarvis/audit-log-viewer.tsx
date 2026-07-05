import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Trash2, Download, ChevronDown, ChevronUp } from "lucide-react";
import {
  getAuditLog, getAuditStats, clearAuditLog, exportAuditLogCSV,
  SEVERITY_CONFIG, EVENT_LABELS,
  type AuditEntry,
} from "@/lib/security-audit";
import { playSound } from "@/lib/sounds";

const SEVERITY_FILTERS: Array<{ value: AuditEntry["severity"] | "all"; label: string }> = [
  { value: "all", label: "Все" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
];

export function AuditLogViewer() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getAuditStats> | null>(null);
  const [severityFilter, setSeverityFilter] = useState<AuditEntry["severity"] | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { refresh(); }, []);

  function refresh() {
    const all = getAuditLog(100);
    setEntries(severityFilter === "all" ? all : all.filter(e => e.severity === severityFilter));
    setStats(getAuditStats());
  }

  useEffect(() => { refresh(); }, [severityFilter]);

  function handleClear() {
    playSound("deactivate");
    clearAuditLog();
    refresh();
  }

  function handleExport() {
    playSound("success");
    const csv = exportAuditLogCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-audit-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary anim-pulse-glow" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary">Security Audit</span>
        </div>
        <div className="flex gap-1">
          <button onClick={handleExport} className="rounded p-1 text-muted-foreground hover:text-primary transition" title="Экспорт CSV">
            <Download className="h-3 w-3" />
          </button>
          <button onClick={handleClear} className="rounded p-1 text-muted-foreground hover:text-destructive transition" title="Очистить лог">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-primary/10 bg-primary/5 p-2 text-center">
            <div className="font-mono text-lg font-bold text-primary">{stats.total}</div>
            <div className="font-mono text-[8px] text-muted-foreground">Всего</div>
          </div>
          <div className="rounded-lg border border-yellow-500/10 bg-yellow-500/5 p-2 text-center">
            <div className="font-mono text-lg font-bold text-yellow-400">{stats.today}</div>
            <div className="font-mono text-[8px] text-muted-foreground">Сегодня</div>
          </div>
          <div className="rounded-lg border border-destructive/10 bg-destructive/5 p-2 text-center">
            <div className="font-mono text-lg font-bold text-destructive">{stats.bySeverity.critical || 0}</div>
            <div className="font-mono text-[8px] text-muted-foreground">Критич.</div>
          </div>
        </div>
      )}

      {/* Severity Filter */}
      <div className="flex gap-1">
        {SEVERITY_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => { playSound("click"); setSeverityFilter(f.value); }}
            className={`rounded px-2 py-0.5 font-mono text-[9px] transition ${
              severityFilter === f.value
                ? "bg-primary/15 text-primary border border-primary/30"
                : "text-muted-foreground border border-transparent hover:bg-primary/5"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Log entries */}
      <div className="max-h-60 space-y-1 overflow-y-auto jarvis-scroll">
        {entries.length === 0 && (
          <div className="py-4 text-center">
            <Shield className="mx-auto mb-2 h-6 w-6 text-primary/30" />
            <p className="font-mono text-[10px] text-muted-foreground">Нет записей</p>
          </div>
        )}
        {entries.map(entry => {
          const sev = SEVERITY_CONFIG[entry.severity];
          const isExpanded = expandedId === entry.id;
          return (
            <div
              key={entry.id}
              className={`rounded-lg border px-2 py-1.5 cursor-pointer transition ${
                entry.severity === "critical" ? "border-destructive/30 bg-destructive/5" :
                entry.severity === "warning" ? "border-yellow-500/20 bg-yellow-500/5" :
                "border-primary/10 bg-card/20"
              }`}
              onClick={() => setExpandedId(isExpanded ? null : entry.id)}
            >
              <div className="flex items-center gap-2">
                <span className={`rounded px-1 py-0.5 font-mono text-[8px] font-bold ${sev.color} bg-current/10`}>
                  {sev.icon}
                </span>
                <span className="flex-1 font-mono text-[10px] text-foreground truncate">{entry.message}</span>
                <span className="font-mono text-[8px] text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
                {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/50" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1.5 border-t border-primary/10 pt-1.5 space-y-1">
                      <div className="flex gap-2">
                        <span className="font-mono text-[8px] text-muted-foreground">Тип:</span>
                        <span className="font-mono text-[8px] text-foreground">{EVENT_LABELS[entry.type]}</span>
                      </div>
                      {entry.details && (
                        <div className="font-mono text-[9px] text-muted-foreground">{entry.details}</div>
                      )}
                      <div className="font-mono text-[8px] text-muted-foreground/60">
                        {new Date(entry.timestamp).toLocaleString("ru-RU")}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}