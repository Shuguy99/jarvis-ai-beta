"use client";

import { useState, useCallback, useRef } from "react";
import { parseCommand, type ParsedCommand } from "@/lib/voice-commands";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

export function useVoiceCommands(
  handlers: Record<string, (...args: any[]) => void>
) {
  const [lastCommand, setLastCommand] = useState<ParsedCommand | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processText = useCallback(
    (text: string): boolean => {
      const cmd = parseCommand(text);
      if (!cmd || cmd.confidence < 0.7) return false;

      playSound("activate");
      setLastCommand(cmd);

      // Auto-clear after 3 seconds
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setLastCommand(null), 3000);

      // Log to activity feed
      addActivityEvent({
        message: `Голосовая команда: ${cmd.display} (${cmd.intent}, ${Math.round(cmd.confidence * 100)}%)`,
        severity: "success",
        category: "voice",
      });

      // Execute handler if registered
      const handler = handlers[cmd.intent];
      if (handler) {
        handler(cmd.params);
        return true; // Command was handled
      }
      return false; // No handler, fall through to LLM
    },
    [handlers]
  );

  return { lastCommand, processText };
}