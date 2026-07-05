/**
 * AgentStatusIndicator — Visual component showing agent loop status.
 *
 * Displays: animated spinner, current tool being called,
 * iteration count, mini log of tool calls, and cancel button.
 * Uses Tailwind with cyan accents matching existing JARVIS style.
 */

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Wrench, X, CheckCircle2, AlertCircle, Brain } from "lucide-react";
import type { AgentStatus, AgentLoopLogEntry } from "@/lib/types";

interface AgentStatusIndicatorProps {
  status: AgentStatus;
  currentTool: string | null;
  iterations: number;
  log: AgentLoopLogEntry[];
  error: string | null;
  onCancel: () => void;
}

const STATUS_LABELS: Record<AgentStatus, { label: string; icon: typeof Brain }> = {
  idle: { label: "Agent Idle", icon: Brain },
  thinking: { label: "Thinking...", icon: Brain },
  "calling-tool": { label: "Calling Tool", icon: Wrench },
  processing: { label: "Processing", icon: Loader2 },
  responding: { label: "Responding", icon: CheckCircle2 },
};

export function AgentStatusIndicator({
  status,
  currentTool,
  iterations,
  log,
  error,
  onCancel,
}: AgentStatusIndicatorProps) {
  const isRunning = status !== "idle";
  const { label, icon: StatusIcon } = STATUS_LABELS[status];
  const isSpinning = status === "thinking" || status === "calling-tool" || status === "processing";

  // Only show tool_call and tool_result entries in the mini log
  const toolLog = log.filter((e) => e.type === "tool_call" || e.type === "tool_result");

  return (
    <AnimatePresence>
      {isRunning && (
        <motion.div
          initial={{ opacity: 0, y: 8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -4, height: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="overflow-hidden"
        >
          <div className="mx-1 mb-2 rounded-lg border jarvis-border-cyan bg-primary/5 px-3 py-2">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {isSpinning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <StatusIcon className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                  {label}
                </span>
                {iterations > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] text-primary/80">
                    #{iterations}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-destructive/80 transition hover:border-destructive/50 hover:bg-destructive/20 hover:text-destructive"
                title="Cancel agent"
              >
                <X className="h-2.5 w-2.5" />
                <span>Stop</span>
              </button>
            </div>

            {/* Current tool name */}
            {currentTool && (status === "calling-tool" || status === "processing") && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <Wrench className="h-2.5 w-2.5 text-primary/60" />
                <span className="font-mono text-[10px] text-primary/70">
                  {status === "calling-tool" ? "Calling" : "Processing"}: {currentTool}
                </span>
                {status === "calling-tool" && (
                  <span className="ml-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-1.5 flex items-center gap-1.5 text-destructive/80">
                <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" />
                <span className="font-mono text-[10px]">{error}</span>
              </div>
            )}

            {/* Mini tool call log */}
            {toolLog.length > 0 && (
              <div className="mt-2 max-h-24 space-y-0.5 overflow-y-auto jarvis-scroll">
                {toolLog.slice(-6).map((entry, i) => (
                  <div
                    key={`${entry.timestamp}-${i}`}
                    className="flex items-start gap-1.5 font-mono text-[9px] leading-tight"
                  >
                    <span className="mt-px flex-shrink-0 text-muted-foreground/50">
                      {entry.type === "tool_call" ? "→" : "←"}
                    </span>
                    <span
                      className={
                        entry.type === "tool_call"
                          ? "text-primary/70"
                          : entry.content.startsWith("Error")
                            ? "text-destructive/70"
                            : "text-emerald-500/70"
                      }
                    >
                      {entry.type === "tool_call" ? entry.toolName : entry.content.slice(0, 80)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}