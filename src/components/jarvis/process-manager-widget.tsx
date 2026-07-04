

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Cpu, ArrowUp, ArrowDown, Search, X, Skull } from "lucide-react";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { useSystemData, refreshSystemData } from "@/hooks/use-system-poller";
import { ConfirmDialog, useConfirmState } from "@/components/jarvis/confirm-dialog";

type SortKey = "cpu" | "mem" | "name";
type SortOrder = "desc" | "asc";

// ── Color helpers ─────────────────────────────────────────────
function cpuColor(v: number): string {
  if (v > 50) return "text-rose-400";
  if (v > 20) return "text-amber-400";
  return "text-emerald-400";
}

function memColor(v: number): string {
  if (v > 50) return "text-rose-400";
  if (v > 20) return "text-amber-400";
  return "text-emerald-400";
}

function cpuBarColor(v: number): string {
  if (v > 50) return "bg-rose-400";
  if (v > 20) return "bg-amber-400";
  return "bg-emerald-400";
}

// ── Sort arrow indicator ──────────────────────────────────────
function SortArrow({
  sortKey,
  activeKey,
  order,
}: {
  sortKey: SortKey;
  activeKey: SortKey;
  order: SortOrder;
}) {
  if (sortKey !== activeKey) return null;
  return order === "desc" ? (
    <ArrowDown className="inline h-2.5 w-2.5 text-primary" />
  ) : (
    <ArrowUp className="inline h-2.5 w-2.5 text-primary" />
  );
}

// ── Main component ────────────────────────────────────────────
export function ProcessManagerWidget() {
  const { processes: rawProcesses } = useSystemData();
  const { confirmState, requestConfirm, resolveConfirm, resolveCancel } = useConfirmState();
  const [sortKey, setSortKey] = useState<SortKey>("cpu");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filter, setFilter] = useState("");
  const [filterInput, setFilterInput] = useState("");
  useEffect(() => { const t = setTimeout(() => setFilter(filterInput), 300); return () => clearTimeout(t); }, [filterInput]);
  const [killingPid, setKillingPid] = useState<number | null>(null);

  const loading = rawProcesses === null;

  const processes = useMemo(() => {
    if (!rawProcesses) return [];
    let list = [...rawProcesses];
    if (filter.trim()) {
      const q = filter.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "cpu") cmp = a.cpu - b.cpu;
      else if (sortKey === "mem") cmp = a.mem - b.mem;
      else cmp = a.name.localeCompare(b.name);
      return sortOrder === "desc" ? -cmp : cmp;
    });
    return list;
  }, [rawProcesses, sortKey, sortOrder, filter]);

  // ── Column sort toggle ─────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  // ── Kill process ───────────────────────────────────────────
  const handleKill = async (pid: number, name: string) => {
    const confirmed = await requestConfirm({
      title: "Kill Process",
      message: `Завершить процесс ${name} (PID ${pid})? Это действие может привести к потере несохранённых данных.`,
      confirmLabel: "Завершить",
      variant: "danger",
    });
    if (!confirmed) return;
    playSound("click", 0.3);
    setKillingPid(pid);
    try {
      const res = await fetch("/api/jarvis/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kill", pid }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Kill failed");
      }
      addActivityEvent({
        message: "Процесс завершён: " + name,
        severity: "warning",
        category: "system",
      });
      playSound("warning", 0.2);
      void refreshSystemData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Kill failed";
      addActivityEvent({
        message: `Ошибка завершения PID ${pid}: ${msg}`,
        severity: "error",
        category: "system",
      });
      playSound("error", 0.3);
    } finally {
      setKillingPid(null);
    }
  };

  // ── Loading state ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm">
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Process Monitor
            </span>
          </div>
          <div className="flex h-20 items-center justify-center font-mono text-xs text-muted-foreground">
            <span className="anim-pulse-glow">Сканирование процессов...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            Process Monitor
          </span>
          <span className="ml-auto font-mono text-[9px] tabular-nums text-muted-foreground/60">
            {processes.length}
          </span>
        </div>

        {/* Search / Filter input */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            placeholder="Фильтр..."
            className="w-full rounded-md border border-primary/10 bg-primary/5 py-1 pl-7 pr-7 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none"
          />
          {filter && (
            <button
              onClick={() => { setFilter(""); setFilterInput(""); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-rose-400"
              aria-label="Очистить фильтр"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[3.5rem_1fr_3.2rem_3.2rem] items-center gap-1 border-b border-primary/10 pb-1">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
            PID
          </span>
          <button
            onClick={() => handleSort("name")}
            className="flex items-center gap-0.5 text-left font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-primary"
          >
            NAME
            <SortArrow sortKey="name" activeKey={sortKey} order={sortOrder} />
          </button>
          <button
            onClick={() => handleSort("cpu")}
            className="flex items-center justify-end gap-0.5 text-right font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-primary"
          >
            CPU
            <SortArrow sortKey="cpu" activeKey={sortKey} order={sortOrder} />
          </button>
          <button
            onClick={() => handleSort("mem")}
            className="flex items-center justify-end gap-0.5 text-right font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-primary"
          >
            MEM
            <SortArrow sortKey="mem" activeKey={sortKey} order={sortOrder} />
          </button>
        </div>

        {/* Process list */}
        <div className="max-h-64 overflow-y-auto jarvis-scroll">
          {processes.length === 0 ? (
            <div className="flex h-16 items-center justify-center font-mono text-[10px] text-muted-foreground/40">
              Нет процессов
            </div>
          ) : (
            <div className="flex flex-col">
              {processes.map((p, i) => (
                <div
                  key={`${p.pid}-${i}`}
                  className="group grid grid-cols-[3.5rem_1fr_3.2rem_3.2rem] items-center gap-1 border-b border-primary/5 py-1 last:border-0"
                >
                  {/* PID */}
                  <span className="truncate font-mono text-[10px] tabular-nums text-muted-foreground/70">
                    {p.pid}
                  </span>

                  {/* Name + kill button */}
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80">
                      {p.name}
                    </span>
                    <button
                      onClick={() => handleKill(p.pid, p.name)}
                      disabled={killingPid === p.pid}
                      className="shrink-0 rounded p-0.5 text-rose-400/0 transition-all duration-150 hover:bg-rose-400/10 hover:text-rose-400 group-hover:text-rose-400/60 disabled:opacity-50"
                      aria-label={`Kill process ${p.name} (PID ${p.pid})`}
                    >
                      <Skull className="h-3 w-3" />
                    </button>
                  </div>

                  {/* CPU */}
                  <div className="flex items-center justify-end gap-1">
                    <div className="h-1 w-8 overflow-hidden rounded-full bg-primary/10">
                      <div
                        className={`h-full rounded-full ${cpuBarColor(p.cpu)}`}
                        style={{ width: `${Math.min(100, p.cpu)}%` }}
                      />
                    </div>
                    <span
                      className={`w-8 text-right font-mono text-[10px] tabular-nums ${cpuColor(p.cpu)}`}
                    >
                      {p.cpu.toFixed(1)}
                    </span>
                  </div>

                  {/* MEM */}
                  <span
                    className={`text-right font-mono text-[10px] tabular-nums ${memColor(p.mem)}`}
                  >
                    {p.mem.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
    <ConfirmDialog
      open={confirmState.open}
      title={confirmState.title}
      message={confirmState.message}
      confirmLabel={confirmState.confirmLabel}
      cancelLabel={confirmState.cancelLabel}
      variant={confirmState.variant}
      onConfirm={resolveConfirm}
      onCancel={resolveCancel}
    />
  </>
  );
}