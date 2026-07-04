

import { useState, useCallback, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────

type StreamEventType = "step" | "tool_call" | "tool_result" | "chunk" | "done" | "error";

interface StreamEvent {
  type: StreamEventType;
  content?: string;
  toolName?: string;
  params?: Record<string, unknown>;
  success?: boolean;
  display?: string;
  text?: string;
  message?: string;
}

interface StreamStep {
  id: number;
  type: "step" | "tool_call" | "tool_result" | "chunk" | "error";
  content: string;
  toolName?: string;
  timestamp: string;
}

interface UseAgentStreamReturn {
  steps: StreamStep[];
  finalText: string;
  isRunning: boolean;
  error: string | null;
  execute: (task: string, tools?: string[]) => void;
  reset: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────

export function useAgentStream(): UseAgentStreamReturn {
  const [steps, setSteps] = useState<StreamStep[]>([]);
  const [finalText, setFinalText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setSteps([]);
    setFinalText("");
    setIsRunning(false);
    setError(null);
  }, []);

  const execute = useCallback(async (task: string, tools?: string[]) => {
    reset();
    setIsRunning(true);
    setError(null);

    const abort = new AbortController();
    abortRef.current = abort;

    const collectedText: string[] = [];
    let stepId = 0;

    try {
      const res = await fetch("/api/jarvis/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, tools }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === "[DONE]") continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }

          if (abort.signal.aborted) break;

          switch (event.type) {
            case "step":
              setSteps((prev) => [...prev, {
                id: ++stepId,
                type: "step",
                content: event.content ?? "",
                timestamp: new Date().toISOString(),
              }]);
              break;

            case "tool_call":
              setSteps((prev) => [...prev, {
                id: ++stepId,
                type: "tool_call",
                content: `Вызов: ${event.toolName}(${JSON.stringify(event.params)})`,
                toolName: event.toolName,
                timestamp: new Date().toISOString(),
              }]);
              break;

            case "tool_result":
              setSteps((prev) => [...prev, {
                id: ++stepId,
                type: "tool_result",
                content: event.success ? (event.display ?? "OK") : `Error: ${event.display}`,
                toolName: event.toolName,
                timestamp: new Date().toISOString(),
              }]);
              break;

            case "chunk":
              collectedText.push(event.text ?? "");
              setFinalText(collectedText.join(""));
              break;

            case "error":
              setError(event.message ?? "Unknown error");
              setSteps((prev) => [...prev, {
                id: ++stepId,
                type: "error",
                content: event.message ?? "Error",
                timestamp: new Date().toISOString(),
              }]);
              break;

            case "done":
              break;
          }
        }
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        const msg = err instanceof Error ? err.message : "Agent stream error";
        setError(msg);
      }
    } finally {
      setIsRunning(false);
    }
  }, [reset]);

  return { steps, finalText, isRunning, error, execute, reset };
}