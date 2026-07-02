"use client";

import { useState, useCallback, useRef } from "react";
import { parseCommand, type ParsedCommand } from "@/lib/voice-commands";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

interface LLMVoiceResult {
  intent: string;
  params: Record<string, string>;
  confidence: number;
}

export function useVoiceCommands(
  handlers: Record<string, (...args: any[]) => void>
) {
  const [lastCommand, setLastCommand] = useState<ParsedCommand | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processText = useCallback(
    async (text: string): Promise<boolean> => {
      // ── Fast local parse first ──
      const cmd = parseCommand(text);

      if (cmd && cmd.confidence >= 0.5) {
        playSound("activate");
        setLastCommand(cmd);

        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setLastCommand(null), 3000);

        addActivityEvent({
          message: `Голосовая команда: ${cmd.display} (${cmd.intent}, ${Math.round(cmd.confidence * 100)}%)`,
          severity: "success",
          category: "voice",
        });

        const handler = handlers[cmd.intent];
        if (handler) {
          handler(cmd.params);
          return true;
        }
        return false;
      }

      // ── LLM Fallback for short text with low/no confidence ──
      if (text.length < 100) {
        setIsProcessing(true);
        try {
          const res = await fetch("/api/jarvis/voice-parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          });

          if (!res.ok) return false;

          const result = (await res.json()) as LLMVoiceResult;

          // If LLM says ask_question, let it go to normal chat
          if (result.intent === "ask_question") return false;

          // Build a ParsedCommand from LLM result
          const llmCmd: ParsedCommand = {
            intent: result.intent,
            params: result.params ?? {},
            confidence: result.confidence,
            display: `LLM: ${result.intent}`,
          };

          playSound("activate");
          setLastCommand(llmCmd);

          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setLastCommand(null), 3000);

          addActivityEvent({
            message: `Голосовая команда (LLM): ${result.intent} (${Math.round(result.confidence * 100)}%)`,
            severity: "success",
            category: "voice",
          });

          const handler = handlers[result.intent];
          if (handler) {
            handler(result.params ?? {});
            return true;
          }
        } catch {
          // Silently fail — fall through to normal chat
        } finally {
          setIsProcessing(false);
        }
      }

      return false;
    },
    [handlers]
  );

  return { lastCommand, processText, isProcessing };
}