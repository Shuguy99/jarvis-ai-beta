/**
 * useAgentLoop — React hook wrapping the AgentLoop class.
 *
 * Connects to the server-side agent API route via SSE,
 * provides real-time status/progress, and integrates with
 * the jarvis-store for message management.
 */

import { useState, useCallback, useRef } from "react";
import type {
  AgentStatus,
  AgentLoopLogEntry,
  ChatMessage,
} from "@/lib/types";
import { useJarvisStore, uid } from "@/lib/jarvis-store";
import { playSound } from "@/lib/sounds";

export interface UseAgentLoopReturn {
  startAgent: (message: string) => void;
  stopAgent: () => void;
  status: AgentStatus;
  currentTool: string | null;
  iterations: number;
  result: string;
  error: string | null;
  log: AgentLoopLogEntry[];
  isRunning: boolean;
}

export function useAgentLoop(): UseAgentLoopReturn {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [iterations, setIterations] = useState(0);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<AgentLoopLogEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const addMessage = useJarvisStore((s) => s.addMessage);
  const updateMessage = useJarvisStore((s) => s.updateMessage);
  const setJarvisState = useJarvisStore((s) => s.setJarvisState);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setCurrentTool(null);
    setIterations(0);
    setResult("");
    setError(null);
    setLog([]);
    setJarvisState("idle");
  }, [setJarvisState]);

  const startAgent = useCallback(
    (message: string) => {
      if (!message.trim()) return;

      // Reset state
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("thinking");
      setCurrentTool(null);
      setIterations(0);
      setResult("");
      setError(null);
      setLog([]);
      setJarvisState("thinking");

      playSound("activate");

      // Add user message to chat
      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: message,
        createdAt: new Date().toISOString(),
        source: "text",
      };
      addMessage(userMsg);

      // Create placeholder assistant message for streaming
      const assistantMsgId = uid();
      addMessage({
        id: assistantMsgId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        streaming: true,
      });

      const collectedText: string[] = [];
      let iter = 0;

      (async () => {
        try {
          const res = await fetch("/api/jarvis/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, tools: [] }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            const errMsg = (data as Record<string, string>).error ?? `HTTP ${res.status}`;
            throw new Error(errMsg);
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
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data: ")) continue;

              const jsonStr = trimmed.slice(6);
              if (jsonStr === "[DONE]") continue;

              let event: Record<string, unknown>;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                continue;
              }

              if (controller.signal.aborted) break;

              const eventType = event.type as string;

              switch (eventType) {
                case "status":
                  setStatus((event.status as AgentStatus) ?? "thinking");
                  break;

                case "iteration":
                  iter = (event.iteration as number) ?? iter;
                  setIterations(iter);
                  break;

                case "tool_call": {
                  const toolName = (event.toolName as string) ?? "unknown";
                  setCurrentTool(toolName);
                  setStatus("calling-tool");
                  setLog((prev) => [
                    ...prev,
                    {
                      iteration: iter,
                      type: "tool_call",
                      toolName,
                      content: `Calling ${toolName}`,
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                  break;
                }

                case "tool_result": {
                  const tName = (event.toolName as string) ?? "unknown";
                  const success = (event.success as boolean) ?? false;
                  const content = (event.content as string) ?? "";
                  setStatus("processing");
                  setLog((prev) => [
                    ...prev,
                    {
                      iteration: iter,
                      type: "tool_result",
                      toolName: tName,
                      content: success ? content : `Error: ${content}`,
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                  break;
                }

                case "chunk": {
                  const token = (event.text as string) ?? "";
                  collectedText.push(token);
                  setResult(collectedText.join(""));
                  setStatus("responding");
                  // Update the streaming assistant message
                  updateMessage(assistantMsgId, {
                    content: collectedText.join(""),
                  });
                  break;
                }

                case "done": {
                  const finalText = collectedText.join("");
                  setResult(finalText);
                  updateMessage(assistantMsgId, {
                    content: finalText,
                    streaming: false,
                  });
                  break;
                }

                case "error": {
                  const errMsg = (event.message as string) ?? "Unknown error";
                  setError(errMsg);
                  setLog((prev) => [
                    ...prev,
                    {
                      iteration: iter,
                      type: "thinking",
                      content: `Error: ${errMsg}`,
                      timestamp: new Date().toISOString(),
                    },
                  ]);
                  // Remove empty assistant message on error
                  updateMessage(assistantMsgId, {
                    content: `Agent error: ${errMsg}`,
                    streaming: false,
                  });
                  break;
                }
              }
            }
          }

          // If we got a result but no explicit done event
          if (collectedText.length > 0 && !error) {
            updateMessage(assistantMsgId, {
              content: collectedText.join(""),
              streaming: false,
            });
          }

          playSound("deactivate");
        } catch (err) {
          if (controller.signal.aborted) {
            setError("Agent loop cancelled");
            updateMessage(assistantMsgId, {
              content: "Agent loop cancelled",
              streaming: false,
            });
          } else {
            const msg = err instanceof Error ? err.message : "Agent error";
            setError(msg);
            updateMessage(assistantMsgId, {
              content: `Agent error: ${msg}`,
              streaming: false,
            });
          }
          playSound("deactivate");
        } finally {
          setStatus("idle");
          setCurrentTool(null);
          setJarvisState("idle");
          abortRef.current = null;
        }
      })();
    },
    [addMessage, updateMessage, setJarvisState],
  );

  const stopAgent = useCallback(() => {
    abortRef.current?.abort();
    reset();
  }, [reset]);

  const isRunning = status !== "idle";

  return {
    startAgent,
    stopAgent,
    status,
    currentTool,
    iterations,
    result,
    error,
    log,
    isRunning,
  };
}