"use client";

import { useState, useCallback, useRef } from "react";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { playSound } from "@/lib/sounds";
import { contextBus } from "@/lib/context-bus";

// ─── Types ───────────────────────────────────────────────────

export type AgentPhase = "idle" | "planning" | "executing" | "reporting" | "done" | "error";

export interface PlanStep {
  id: number;
  description: string;
}

export interface ProgressEvent {
  stepId: number;
  type: "thinking" | "tool_call" | "tool_result";
  content: string;
  toolName?: string;
}

export interface StepResult {
  stepId: number;
  success: boolean;
  summary: string;
}

export interface AgentRunResult {
  plan: PlanStep[];
  progress: ProgressEvent[];
  stepResults: StepResult[];
  report: string;
}

// ─── Hook ────────────────────────────────────────────────────

export function useAgentEngine(): {
  phase: AgentPhase;
  plan: PlanStep[];
  currentStepId: number | null;
  progress: ProgressEvent[];
  stepResults: StepResult[];
  report: string;
  error: string | null;
  isRunning: boolean;
  executeTask: (task: string, tools?: string[]) => void;
  abort: () => void;
  reset: () => void;
} {
  const [phase, setPhase] = useState<AgentPhase>("idle");
  const [plan, setPlan] = useState<PlanStep[]>([]);
  const [currentStepId, setCurrentStepId] = useState<number | null>(null);
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [stepResults, setStepResults] = useState<StepResult[]>([]);
  const [report, setReport] = useState("");
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const taskRef = useRef<string>("");

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("idle");
    setPlan([]);
    setCurrentStepId(null);
    setProgress([]);
    setStepResults([]);
    setReport("");
    setError(null);
    playSound("deactivate");
  }, []);

  const executeTask = useCallback(
    (task: string, tools?: string[]) => {
      if (!task.trim()) return;

      // Reset all state
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      taskRef.current = task;

      setPhase("planning");
      setPlan([]);
      setCurrentStepId(null);
      setProgress([]);
      setStepResults([]);
      setReport("");
      setError(null);

      // Publish to context bus
      contextBus.publish({
        type: "agent:task-started",
        data: { task },
        timestamp: Date.now(),
      });

      // Activity feed
      addActivityEvent({
        message: `Агент JARVIS начал задачу: ${task.slice(0, 80)}${task.length > 80 ? "…" : ""}`,
        severity: "info",
        category: "system",
      });

      playSound("activate");

      // Start SSE fetch
      (async () => {
        try {
          const response = await fetch("/api/jarvis/agent/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task, tools }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const text = await response.text();
            try {
              const errData = JSON.parse(text);
              setPhase("error");
              setError(errData.message ?? `HTTP ${response.status}`);
            } catch {
              setPhase("error");
              setError(`HTTP ${response.status}: ${text.slice(0, 200)}`);
            }
            playSound("deactivate");
            return;
          }

          if (!response.body) {
            setPhase("error");
            setError("No response body received");
            playSound("deactivate");
            return;
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events from buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

            let currentEvent = "";
            for (const line of lines) {
              if (line.startsWith("event: ")) {
                currentEvent = line.slice(7).trim();
              } else if (line.startsWith("data: ") && currentEvent) {
                try {
                  const data = JSON.parse(line.slice(6));

                  switch (currentEvent) {
                    case "plan": {
                      const steps: PlanStep[] = Array.isArray(data.steps)
                        ? data.steps.map(
                            (s: { id?: number; description?: string }, i: number) => ({
                              id: s.id ?? i + 1,
                              description: String(s.description ?? ""),
                            })
                          )
                        : [];
                      setPlan(steps);
                      setPhase("executing");
                      break;
                    }
                    case "step_start":
                      setCurrentStepId(data.stepId ?? null);
                      break;
                    case "step_progress":
                      setProgress((prev) => [
                        ...prev,
                        {
                          stepId: data.stepId,
                          type: data.type,
                          content: data.content ?? "",
                          toolName: data.toolName,
                        },
                      ]);
                      break;
                    case "step_done":
                      setStepResults((prev) => [
                        ...prev,
                        {
                          stepId: data.stepId,
                          success: data.success ?? false,
                          summary: data.summary ?? "",
                        },
                      ]);
                      break;
                    case "report":
                      setReport(data.content ?? "");
                      setPhase("reporting");
                      break;
                    case "done":
                      setPhase("done");
                      playSound("deactivate");
                      contextBus.publish({
                        type: "agent:task-completed",
                        data: { task: taskRef.current, success: true },
                        timestamp: Date.now(),
                      });
                      addActivityEvent({
                        message: "Агент JARVIS завершил задачу",
                        severity: "success",
                        category: "system",
                      });
                      break;
                    case "error":
                      setPhase("error");
                      setError(data.message ?? "Unknown error");
                      playSound("deactivate");
                      break;
                  }
                } catch {
                  /* skip unparseable data */
                }
                currentEvent = "";
              }
            }
          }
        } catch (err) {
          if ((err as Error).name === "AbortError") {
            setPhase("error");
            setError("Задача отменена");
          } else {
            setPhase("error");
            setError(err instanceof Error ? err.message : "Network error");
          }
          playSound("deactivate");
        } finally {
          abortRef.current = null;
        }
      })();
    },
    []
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const isRunning =
    phase === "planning" ||
    phase === "executing" ||
    phase === "reporting";

  return {
    phase,
    plan,
    currentStepId,
    progress,
    stepResults,
    report,
    error,
    isRunning,
    executeTask,
    abort,
    reset,
  };
}