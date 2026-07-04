

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Zap,
  X,
  Send,
  Wrench,
  CheckCircle,
  Loader2,
  Clock,
  Cpu,
  List,
  Globe,
  FolderOpen,
  CloudSun,
  Calculator,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  RotateCcw,
  Circle,
  Ban,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import {
  useAgentEngine,
  type AgentPhase,
  type PlanStep,
  type ProgressEvent,
  type StepResult,
} from "@/hooks/use-agent-engine";

// ─── Types ─────────────────────────────────────────────────────

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  id: string;
  task: string;
  report: string;
  plan: PlanStep[];
  stepResults: StepResult[];
  progress: ProgressEvent[];
  timestamp: string;
}

// ─── Tool metadata for UI ──────────────────────────────────────

const TOOL_META: {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}[] = [
  { name: "system_info", icon: Cpu, label: "System Info" },
  { name: "system_processes", icon: List, label: "Processes" },
  { name: "web_search", icon: Globe, label: "Web Search" },
  { name: "file_list", icon: FolderOpen, label: "File List" },
  { name: "get_weather", icon: CloudSun, label: "Weather" },
  { name: "calculator", icon: Calculator, label: "Calculator" },
  { name: "get_time", icon: Clock, label: "World Clock" },
];

const MAX_HISTORY = 5;

// ─── Step status helpers ───────────────────────────────────────

function StepStatusIcon({
  stepId,
  currentStepId,
  stepResults,
}: {
  stepId: number;
  currentStepId: number | null;
  stepResults: StepResult[];
}) {
  const isDone = stepResults.some((r) => r.stepId === stepId);
  const isCurrent = currentStepId === stepId;

  if (isDone) {
    return <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />;
  }
  if (isCurrent) {
    return (
      <span className="relative flex h-4 w-4 flex-shrink-0 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
        <Circle className="h-2.5 w-2.5 fill-cyan-400/40 text-cyan-400/40" />
      </span>
    );
  }
  return <Circle className="h-4 w-4 text-muted-foreground/20 flex-shrink-0" />;
}

function ProgressIcon({
  type,
  className,
}: {
  type: ProgressEvent["type"];
  className?: string;
}) {
  switch (type) {
    case "thinking":
      return <Loader2 className={`h-3 w-3 text-cyan-400 ${className ?? ""}`} />;
    case "tool_call":
      return <Wrench className={`h-3 w-3 text-amber-400 ${className ?? ""}`} />;
    case "tool_result":
      return <CheckCircle className={`h-3 w-3 text-emerald-400 ${className ?? ""}`} />;
  }
}

function progressColor(type: ProgressEvent["type"]): string {
  switch (type) {
    case "thinking":
      return "border-cyan-400/20 bg-cyan-400/5";
    case "tool_call":
      return "border-amber-400/20 bg-amber-400/5";
    case "tool_result":
      return "border-emerald-400/20 bg-emerald-400/5";
  }
}

function timeLabel(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function phaseLabel(phase: AgentPhase): string {
  switch (phase) {
    case "planning":
      return "Планирование...";
    case "executing":
      return "Выполнение...";
    case "reporting":
      return "Формирование отчёта...";
    case "done":
      return "Завершено";
    case "error":
      return "Ошибка";
    default:
      return "";
  }
}

// ─── Main component ────────────────────────────────────────────

export function AgentPanel({ open, onClose }: AgentPanelProps) {
  const agent = useAgentEngine();

  const [task, setTask] = useState("");
  const [enabledTools, setEnabledTools] = useState<Set<string>>(
    new Set(TOOL_META.map((t) => t.name))
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [lastTask, setLastTask] = useState("");

  const taskRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add completed runs to history when phase becomes "done"
  useEffect(() => {
    if (agent.phase === "done" && lastTask) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          task: lastTask,
          report: agent.report,
          plan: agent.plan,
          stepResults: agent.stepResults,
          progress: agent.progress,
          timestamp: new Date().toISOString(),
        };
        const next = [entry, ...prev];
        return next.slice(0, MAX_HISTORY);
      });
    }
    }, [agent.phase, agent.report, agent.plan, agent.stepResults, agent.progress, lastTask]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  // Auto-scroll progress
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [agent.progress, agent.report]);

  const toggleTool = useCallback((name: string) => {
    setEnabledTools((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size > 1) next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = task.trim();
    if (!trimmed || agent.isRunning) return;
    setLastTask(trimmed);
    agent.executeTask(trimmed, Array.from(enabledTools));
  }, [task, agent, enabledTools]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setTask(entry.task);
    playSound("click");
  }, []);

  const handleReset = useCallback(() => {
    agent.reset();
    setTask("");
    setLastTask("");
  }, [agent]);

  if (!open) return null;

  const hasContent =
    agent.plan.length > 0 ||
    agent.progress.length > 0 ||
    agent.report ||
    agent.isRunning;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 250 }}
        className="relative z-50 flex h-full w-full max-w-[500px] flex-col border-l border-primary/20 bg-background/90 backdrop-blur-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-primary/10 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary jarvis-glow">
                Agent Mode
              </span>
              <div className="font-mono text-[9px] text-muted-foreground/60">
                Tool-calling framework
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="jarvis-scroll flex-1 overflow-y-auto p-4">
            {/* Task Input */}
            <div className="mb-4">
              <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <Zap className="h-3 w-3 text-primary" />
                Task Description
              </label>
              <textarea
                ref={taskRef}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want the agent to do..."
                disabled={agent.isRunning}
                rows={3}
                className="w-full resize-none rounded-lg border border-primary/20 bg-card/60 p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={agent.isRunning || !task.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition-all hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {agent.isRunning ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {agent.isRunning ? phaseLabel(agent.phase) : "Execute"}
                </button>
                {agent.isRunning && (
                  <button
                    onClick={agent.abort}
                    className="flex items-center gap-1 rounded-md border border-rose-400/30 bg-rose-400/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-rose-400 transition-all hover:bg-rose-400/20"
                  >
                    <Ban className="h-3 w-3" />
                    Отменить
                  </button>
                )}
                <button
                  onClick={handleReset}
                  disabled={agent.isRunning}
                  className="flex items-center gap-1 rounded-md px-2 py-1.5 font-mono text-[10px] text-muted-foreground/60 transition-colors hover:text-rose-400 disabled:opacity-40"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
                <span className="ml-auto font-mono text-[9px] text-muted-foreground/40">
                  Ctrl+Enter
                </span>
              </div>
            </div>

            {/* Tool Selector */}
            <div className="mb-4">
              <button
                onClick={() => {
                  setShowTools(!showTools);
                  playSound("click");
                }}
                className="mb-1.5 flex w-full items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
              >
                <Wrench className="h-3 w-3 text-primary" />
                Tools ({enabledTools.size}/{TOOL_META.length})
                {showTools ? (
                  <ChevronDown className="ml-auto h-3 w-3" />
                ) : (
                  <ChevronRight className="ml-auto h-3 w-3" />
                )}
              </button>

              <AnimatePresence>
                {showTools && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 gap-1 rounded-lg border border-primary/10 bg-card/40 p-2">
                      {TOOL_META.map((tool) => {
                        const Icon = tool.icon;
                        const checked = enabledTools.has(tool.name);
                        return (
                          <label
                            key={tool.name}
                            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-primary/5"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTool(tool.name)}
                              disabled={agent.isRunning}
                              className="h-3 w-3 rounded border-primary/30 bg-background accent-primary"
                            />
                            <Icon
                              className={`h-3.5 w-3.5 ${checked ? "text-primary" : "text-muted-foreground/40"}`}
                            />
                            <span
                              className={`font-mono text-[10px] ${checked ? "text-foreground" : "text-muted-foreground/50"}`}
                            >
                              {tool.label}
                            </span>
                            <span className="ml-auto font-mono text-[8px] text-muted-foreground/30">
                              {tool.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Execution Progress — Phase-based rendering */}
            {hasContent && (
              <div className="mb-4">
                <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Loader2
                    className={`h-3 w-3 text-primary ${agent.isRunning ? "animate-spin" : ""}`}
                  />
                  Execution Progress
                  {agent.phase !== "idle" && (
                    <span className="ml-1 text-primary/60">
                      — {phaseLabel(agent.phase)}
                    </span>
                  )}
                </label>

                <div
                  ref={scrollRef}
                  className="jarvis-scroll max-h-[300px] space-y-2 overflow-y-auto rounded-lg border border-primary/10 bg-card/40 p-2"
                >
                  {/* Planning state */}
                  {agent.phase === "planning" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 px-2.5 py-3"
                    >
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="font-mono text-xs text-primary animate-pulse">
                        Планирование...
                      </span>
                    </motion.div>
                  )}

                  {/* Plan steps timeline */}
                  {agent.plan.length > 0 && (
                    <div className="space-y-1.5">
                      {agent.plan.map((step) => {
                        const stepProgress = agent.progress.filter(
                          (p) => p.stepId === step.id
                        );
                        const stepResult = agent.stepResults.find(
                          (r) => r.stepId === step.id
                        );
                        const isCurrent = agent.currentStepId === step.id;

                        return (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {/* Step header */}
                            <div
                              className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                                isCurrent
                                  ? "bg-primary/5 border border-primary/15"
                                  : ""
                              }`}
                            >
                              <StepStatusIcon
                                stepId={step.id}
                                currentStepId={agent.currentStepId}
                                stepResults={agent.stepResults}
                              />
                              <span
                                className={`font-mono text-[10px] ${
                                  isCurrent
                                    ? "text-foreground"
                                    : stepResult
                                      ? "text-foreground/70"
                                      : "text-muted-foreground/50"
                                }`}
                              >
                                {step.description}
                              </span>
                            </div>

                            {/* Step progress events */}
                            {stepProgress.length > 0 && (
                              <div className="ml-6 mt-1 space-y-1">
                                {stepProgress.map((pe, idx) => (
                                  <motion.div
                                    key={`${step.id}-${pe.type}-${idx}`}
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.15 }}
                                    className={`rounded border px-2 py-1.5 ${progressColor(pe.type)}`}
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <ProgressIcon type={pe.type} />
                                      {pe.toolName && (
                                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] text-primary">
                                          {pe.toolName}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 font-mono text-[10px] leading-relaxed text-foreground/80 break-all whitespace-pre-wrap">
                                      {pe.content.length > 300
                                        ? pe.content.slice(0, 300) + "…"
                                        : pe.content}
                                    </p>
                                  </motion.div>
                                ))}
                              </div>
                            )}

                            {/* Step result summary */}
                            {stepResult && (
                              <div className="ml-6 mt-1">
                                <p
                                  className={`font-mono text-[10px] ${
                                    stepResult.success
                                      ? "text-emerald-400/70"
                                      : "text-rose-400/70"
                                  }`}
                                >
                                  {stepResult.success ? "✓" : "✗"}{" "}
                                  {stepResult.summary.length > 200
                                    ? stepResult.summary.slice(0, 200) + "…"
                                    : stepResult.summary}
                                </p>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reporting state */}
                  {agent.phase === "reporting" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 px-2.5 py-2"
                    >
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="font-mono text-[10px] text-muted-foreground animate-pulse">
                        Формирование отчёта...
                      </span>
                    </motion.div>
                  )}

                  {/* Still processing indicator */}
                  {agent.phase === "executing" &&
                    agent.plan.length > 0 &&
                    !agent.currentStepId && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 px-2.5 py-2"
                      >
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        <span className="font-mono text-[10px] text-muted-foreground animate-pulse">
                          Processing...
                        </span>
                      </motion.div>
                    )}
                </div>
              </div>
            )}

            {/* Error */}
            {agent.phase === "error" && agent.error && (
              <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2">
                <span className="font-mono text-[10px] text-rose-400">
                  {agent.error}
                </span>
              </div>
            )}

            {/* Report */}
            {agent.phase === "done" && agent.report && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <MessageSquare className="h-3 w-3 text-primary" />
                  Report
                </label>
                <div className="jarvis-box-glow rounded-lg border border-primary/20 bg-card/60 p-3">
                  <p className="font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                    {agent.report}
                  </p>
                </div>
              </motion.div>
            )}

            {/* History */}
            {history.length > 0 && (
              <div>
                <button
                  onClick={() => {
                    setShowHistory(!showHistory);
                    playSound("click");
                  }}
                  className="mb-1.5 flex w-full items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
                >
                  <Clock className="h-3 w-3 text-primary" />
                  History ({history.length})
                  {showHistory ? (
                    <ChevronDown className="ml-auto h-3 w-3" />
                  ) : (
                    <ChevronRight className="ml-auto h-3 w-3" />
                  )}
                </button>

                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-1">
                        {history.map((entry) => (
                          <button
                            key={entry.id}
                            onClick={() => loadFromHistory(entry)}
                            className="w-full rounded-md border border-primary/10 bg-card/30 px-2.5 py-2 text-left transition-colors hover:bg-primary/5 hover:border-primary/20"
                          >
                            <p className="font-mono text-[10px] text-foreground/80 truncate">
                              {entry.task}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="font-mono text-[8px] text-muted-foreground/50">
                                {timeLabel(entry.timestamp)}
                              </span>
                              {entry.stepResults.length > 0 && (
                                <span className="rounded bg-emerald-400/10 px-1 py-0.5 font-mono text-[8px] text-emerald-400">
                                  {entry.stepResults.length} step{entry.stepResults.length > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-primary/10 px-4 py-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[8px] text-muted-foreground/40">
              JARVIS AGENT v2.0
            </span>
            <span className="font-mono text-[8px] text-muted-foreground/40">
              MAX {MAX_HISTORY} HISTORY
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}