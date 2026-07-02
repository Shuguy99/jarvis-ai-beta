"use client";

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
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

// ─── Types ─────────────────────────────────────────────────────

interface AgentPanelProps {
  open: boolean;
  onClose: () => void;
}

interface Step {
  id: number;
  type: "thinking" | "tool_call" | "tool_result" | "final_answer";
  content: string;
  toolName?: string;
  timestamp: string;
}

interface ToolCallRecord {
  tool: string;
  params: Record<string, unknown>;
  result: string;
}

interface AgentResponse {
  reply: string;
  toolCalls: ToolCallRecord[];
  steps: Step[];
  timestamp: string;
  error?: string;
  ollamaNotRunning?: boolean;
}

interface HistoryEntry {
  id: string;
  task: string;
  reply: string;
  steps: Step[];
  toolCalls: ToolCallRecord[];
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

// ─── Step icon helper ──────────────────────────────────────────

function StepIcon({
  type,
  className,
}: {
  type: Step["type"];
  className?: string;
}) {
  switch (type) {
    case "thinking":
      return <Loader2 className={`h-3.5 w-3.5 animate-spin text-cyan-400 ${className ?? ""}`} />;
    case "tool_call":
      return <Wrench className={`h-3.5 w-3.5 text-amber-400 ${className ?? ""}`} />;
    case "tool_result":
      return <CheckCircle className={`h-3.5 w-3.5 text-emerald-400 ${className ?? ""}`} />;
    case "final_answer":
      return <MessageSquare className={`h-3.5 w-3.5 text-primary ${className ?? ""}`} />;
  }
}

function stepColor(type: Step["type"]): string {
  switch (type) {
    case "thinking":
      return "border-cyan-400/30 bg-cyan-400/5";
    case "tool_call":
      return "border-amber-400/30 bg-amber-400/5";
    case "tool_result":
      return "border-emerald-400/30 bg-emerald-400/5";
    case "final_answer":
      return "border-primary/30 bg-primary/5";
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

// ─── Main component ────────────────────────────────────────────

export function AgentPanel({ open, onClose }: AgentPanelProps) {
  const [task, setTask] = useState("");
  const [enabledTools, setEnabledTools] = useState<Set<string>>(
    new Set(TOOL_META.map((t) => t.name))
  );
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [reply, setReply] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [error, setError] = useState("");

  const taskRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // Auto-scroll steps
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, reply]);

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

  const handleSubmit = useCallback(async () => {
    const trimmed = task.trim();
    if (!trimmed || running) return;

    setRunning(true);
    setSteps([]);
    setReply("");
    setError("");
    playSound("activate");

    addActivityEvent({
      message: `Agent task started: "${trimmed.slice(0, 60)}${trimmed.length > 60 ? "…" : ""}"`,
      severity: "info",
      category: "system",
    });

    try {
      const res = await fetch("/api/jarvis/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: trimmed,
          tools: Array.from(enabledTools),
        }),
      });

      const data = (await res.json()) as AgentResponse;

      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        playSound("error");
        addActivityEvent({
          message: `Agent task failed: ${data.error ?? "Unknown error"}`,
          severity: "error",
          category: "system",
        });
        setRunning(false);
        return;
      }

      // Animate steps in one by one
      for (let i = 0; i < data.steps.length; i++) {
        const step = data.steps[i];
        setSteps((prev) => [...prev, step]);
        // Small delay for visual effect
        if (i < data.steps.length - 1) {
          await new Promise((r) => setTimeout(r, 150));
        }
      }

      setReply(data.reply);
      playSound("success");

      // Add to history
      setHistory((prev) => {
        const entry: HistoryEntry = {
          id: crypto.randomUUID(),
          task: trimmed,
          reply: data.reply,
          steps: data.steps,
          toolCalls: data.toolCalls,
          timestamp: data.timestamp,
        };
        const next = [entry, ...prev];
        return next.slice(0, MAX_HISTORY);
      });

      addActivityEvent({
        message: `Agent task completed successfully (${data.toolCalls.length} tool calls)`,
        severity: "success",
        category: "system",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      playSound("error");
      addActivityEvent({
        message: `Agent error: ${msg}`,
        severity: "error",
        category: "system",
      });
    } finally {
      setRunning(false);
    }
  }, [task, running, enabledTools]);

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
    setSteps(entry.steps);
    setReply(entry.reply);
    setError("");
    playSound("click");
  }, []);

  const handleReset = useCallback(() => {
    setTask("");
    setSteps([]);
    setReply("");
    setError("");
    playSound("deactivate");
  }, []);

  if (!open) return null;

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
                disabled={running}
                rows={3}
                className="w-full resize-none rounded-lg border border-primary/20 bg-card/60 p-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 outline-none transition-colors focus:border-primary/50 focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
              />
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={running || !task.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-primary/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-primary transition-all hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {running ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {running ? "Executing..." : "Execute"}
                </button>
                <button
                  onClick={handleReset}
                  disabled={running}
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
                              disabled={running}
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

            {/* Execution Progress */}
            {(steps.length > 0 || running) && (
              <div className="mb-4">
                <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Loader2
                    className={`h-3 w-3 text-primary ${running ? "animate-spin" : ""}`}
                  />
                  Execution Progress
                </label>

                <div
                  ref={scrollRef}
                  className="jarvis-scroll max-h-[300px] space-y-2 overflow-y-auto rounded-lg border border-primary/10 bg-card/40 p-2"
                >
                  <AnimatePresence initial={false}>
                    {steps.map((step) => (
                      <motion.div
                        key={step.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className={`rounded-md border px-2.5 py-2 ${stepColor(step.type)}`}
                      >
                        <div className="flex items-start gap-2">
                          <StepIcon type={step.type} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                {step.type.replace("_", " ")}
                              </span>
                              {step.toolName && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[8px] text-primary">
                                  {step.toolName}
                                </span>
                              )}
                              <span className="ml-auto font-mono text-[8px] tabular-nums text-muted-foreground/40">
                                {timeLabel(step.timestamp)}
                              </span>
                            </div>
                            <p className="mt-1 font-mono text-[10px] leading-relaxed text-foreground/80 break-all whitespace-pre-wrap">
                              {step.content.length > 300
                                ? step.content.slice(0, 300) + "…"
                                : step.content}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {running && (
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
            {error && (
              <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/5 px-3 py-2">
                <span className="font-mono text-[10px] text-rose-400">
                  {error}
                </span>
              </div>
            )}

            {/* Final Answer */}
            {reply && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <label className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <MessageSquare className="h-3 w-3 text-primary" />
                  Result
                </label>
                <div className="jarvis-box-glow rounded-lg border border-primary/20 bg-card/60 p-3">
                  <p className="font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
                    {reply}
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
                              {entry.toolCalls.length > 0 && (
                                <span className="rounded bg-amber-400/10 px-1 py-0.5 font-mono text-[8px] text-amber-400">
                                  {entry.toolCalls.length} tool{entry.toolCalls.length > 1 ? "s" : ""}
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
              JARVIS AGENT v1.0
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