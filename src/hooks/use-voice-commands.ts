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

const CONFIRMATIONS: Record<string, (params: Record<string, string>) => string> = {
  toggle_fullscreen: () => "Полноэкранный режим, сэр.",
  new_chat: () => "Новый чат создан.",
  toggle_notes: () => "Заметки, сэр.",
  capture_screen: () => "Скриншот сделан, сэр.",
  toggle_voice: (p) => {
    if (p.direction === "off" || p.direction === "mute") return "Голосовой вывод отключён.";
    return "Голосовой вывод включён.";
  },
  open_widget: (p) => {
    const names: Record<string, string> = {
      "заметки": "заметки", "notes": "заметки", "настройки": "настройки",
      "settings": "настройки", "калькулятор": "калькулятор", "calculator": "калькулятор",
      "агент": "агент", "agent": "агент", "плагины": "плагины", "plugins": "плагины",
      "раскладка": "настройку раскладки", "layout": "настройку раскладки", "markdown": "редактор Markdown",
    };
    const widget = names[p.widget ?? ""] ?? "виджет";
    return `Открываю ${widget}, сэр.`;
  },
  set_timer: (p) => {
    const secs = parseInt(p.seconds || "0", 10);
    if (secs > 0) {
      const mins = Math.floor(secs / 60);
      const remSecs = secs % 60;
      if (mins > 0 && remSecs > 0) return `Таймер установлен на ${mins} минут ${remSecs} секунд.`;
      if (mins > 0) return `Таймер установлен на ${mins} минут.`;
      return `Таймер установлен на ${remSecs} секунд.`;
    }
    return "Таймер открыт, сэр.";
  },
  calculator: () => "Калькулятор, сэр.",
  start_pomodoro: () => "Режим фокус запущен, сэр.",
  search_web: () => "Ищу в интернете, сэр.",
  get_weather: () => "Погода, сэр.",
  get_time: () => "Текущее время показано, сэр.",
  system_status: () => "Системный статус, сэр.",
  toggle_theme: () => "Тема изменена, сэр.",
  analyze_image: () => "Жду изображение для анализа.",
  generate_image: () => "Готов генерировать изображение.",
};

export function useVoiceCommands(
  handlers: Record<string, (...args: any[]) => void>,
  options?: { speak?: (text: string) => void }
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

          if (options?.speak) {
            const confirmFn = CONFIRMATIONS[cmd.intent];
            if (confirmFn) {
              options.speak(confirmFn(cmd.params));
            }
          }

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

            if (options?.speak) {
              const confirmFn = CONFIRMATIONS[result.intent];
              if (confirmFn) {
                options.speak(confirmFn(result.params ?? {}));
              }
            }

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
    [handlers, options]
  );

  return { lastCommand, processText, isProcessing };
}