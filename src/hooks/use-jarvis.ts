"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ChatMessage, Conversation } from "@/lib/types";
import type { PersonaId, ResponseStyle } from "@/components/jarvis/settings-panel";
import {
  useJarvisStore,
  uid,
  trunc,
  type JarvisState,
  type Source,
  type JarvisSettings,
  type CommandHandlers,
} from "@/lib/jarvis-store";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { publishChatMessage } from "@/lib/context-bus";

// ── Re-exports for backward compatibility ─────────────────────
export type { JarvisState, CommandHandlers, JarvisSettings };
export type UseJarvisReturn = ReturnType<typeof useJarvis>;

// ── Options ───────────────────────────────────────────────────

interface UseJarvisOptions {
  autoSpeak?: boolean;
  volume?: number;
  ttsRate?: number;
  ttsPitch?: number;
  settings?: Partial<JarvisSettings>;
  commandHandlers?: CommandHandlers;
}

// ── Browser-API helpers (non-serializable, stay in hook) ─────

function pickRussianVoice(): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices.length) return null;

  const ruVoices = voices.filter((v) => v.lang.startsWith("ru"));
  if (!ruVoices.length) return null;

  const preferred = ["Microsoft Irina", "Microsoft Pavel", "Google русский", "Yandex"];
  for (const name of preferred) {
    const found = ruVoices.find((v) => v.name.includes(name));
    if (found) return found;
  }

  const exact = ruVoices.find((v) => v.lang === "ru-RU");
  if (exact) return exact;
  const local = ruVoices.find((v) => v.localService);
  if (local) return local;
  return ruVoices[0];
}

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ── Hook ──────────────────────────────────────────────────────

export function useJarvis(opts: UseJarvisOptions = {}) {
  const { autoSpeak = true, volume = 1.0, ttsRate = 1.05, ttsPitch = 0.95, settings: externalSettings } = opts;

  // ── Zustand selectors (fine-grained reactivity) ───────────
  const messages = useJarvisStore((s) => s.messages);
  const jarvisState = useJarvisStore((s) => s.jarvisState);
  const error = useJarvisStore((s) => s.error);
  const autoSpeakOn = useJarvisStore((s) => s.autoSpeakOn);
  const searchedSources = useJarvisStore((s) => s.searchedSources);
  const conversations = useJarvisStore((s) => s.conversations);
  const activeConvoId = useJarvisStore((s) => s.activeConvoId);
  const isRecording = useJarvisStore((s) => s.isRecording);
  const audioLevel = useJarvisStore((s) => s.audioLevel);
  const continuousMode = useJarvisStore((s) => s.continuousMode);

  // ── Browser-only refs ─────────────────────────────────────
  const ttsRateRef = useRef(ttsRate);
  const ttsPitchRef = useRef(ttsPitch);
  const volumeRef = useRef(volume);
  const behaviorRef = useRef<Partial<JarvisSettings>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const speakingAbortRef = useRef<boolean>(false);
  const russianVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const commandHandlersRef = useRef<CommandHandlers>(opts.commandHandlers ?? {});

  // Sync TTS/behavior refs when props change
  useEffect(() => {
    if (externalSettings) {
      ttsRateRef.current = externalSettings.ttsRate ?? ttsRate;
      ttsPitchRef.current = externalSettings.ttsPitch ?? ttsPitch;
      volumeRef.current = externalSettings.volume ?? volume;
      behaviorRef.current = externalSettings;
    }
  }, [externalSettings, ttsRate, ttsPitch, volume]);

  // ── Conversation persistence ──────────────────────────────

  const persistMessage = useCallback(
    async (role: ChatMessage["role"], content: string) => {
      const convoId = useJarvisStore.getState().activeConvoId;
      if (!convoId) return;
      try {
        await fetch(`/api/jarvis/conversations/${convoId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, content }),
        });
      } catch {
        /* ignore persistence errors */
      }
    },
    []
  );

  const ensureConversation = useCallback(async (firstUserText: string) => {
    const convoId = useJarvisStore.getState().activeConvoId;
    if (convoId) return convoId;
    try {
      const res = await fetch("/api/jarvis/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstUserText, role: "user" }),
      });
      const data = await res.json();
      if (data?.conversation?.id) {
        useJarvisStore.getState().setActiveConvoId(data.conversation.id);
        useJarvisStore.getState().addConversation(data.conversation);
        return data.conversation.id as string;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/conversations");
      const data = await res.json();
      useJarvisStore.getState().setConversations(data.conversations ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const selectConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/jarvis/conversations/${id}`);
      const data = await res.json();
      if (data?.conversation) {
        const c = data.conversation as Conversation;
        useJarvisStore.getState().setActiveConvoId(c.id);
        useJarvisStore.getState().setMessages(
          c.messages.map((m) => ({
            id: m.id,
            role: m.role as ChatMessage["role"],
            content: m.content,
            createdAt: m.createdAt,
          }))
        );
        useJarvisStore.getState().setSearchedSources(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const newConversation = useCallback(() => {
    useJarvisStore.getState().clearChat();
    useJarvisStore.getState().setActiveConvoId(null);
    addActivityEvent({ severity: "info", category: "chat", message: "Новая сессия создана" });
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/jarvis/conversations/${id}`, { method: "DELETE" });
      useJarvisStore.getState().removeConversation(id);
      if (useJarvisStore.getState().activeConvoId === id) newConversation();
    } catch {
      /* ignore */
    }
  }, [newConversation]);

  // ── TTS (browser SpeechSynthesis) ─────────────────────────

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    const load = () => {
      russianVoiceRef.current = pickRussianVoice();
    };
    load();
    synth.addEventListener("voiceschanged", load);
    return () => synth.removeEventListener("voiceschanged", load);
  }, []);

  const stopSpeaking = useCallback(() => {
    speakingAbortRef.current = true;
    const synth = window.speechSynthesis;
    if (synth) synth.cancel();
    const st = useJarvisStore.getState().jarvisState;
    if (st === "speaking") useJarvisStore.getState().setJarvisState("idle");
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const synth = window.speechSynthesis;
      if (!synth) {
        useJarvisStore.getState().setJarvisState("idle");
        return;
      }

      speakingAbortRef.current = false;
      useJarvisStore.getState().setJarvisState("speaking");
      addActivityEvent({ severity: "info", category: "voice", message: "Озвучка ответа..." });
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = ttsRateRef.current;
      utterance.pitch = ttsPitchRef.current;
      utterance.volume = volumeRef.current;

      const voice = russianVoiceRef.current || pickRussianVoice();
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        if (!speakingAbortRef.current) useJarvisStore.getState().setJarvisState("idle");
      };
      utterance.onerror = (e) => {
        if (e.error !== "canceled") {
          console.error("SpeechSynthesis error", e);
        }
        useJarvisStore.getState().setJarvisState("idle");
      };

      // Chrome workaround: long text can stop mid-speech
      utterance.onpause = () => {
        if (!speakingAbortRef.current) {
          setTimeout(() => {
            if (synth.speaking && !synth.pending && !speakingAbortRef.current) {
              synth.resume();
            }
          }, 100);
        }
      };

      synth.speak(utterance);
    },
    []
  );

  // ── Command parser (local commands) ───────────────────────
  const processCommand = useCallback(
    async (text: string): Promise<{ handled: boolean; response?: string } | null> => {
      const cmd = text.trim().toLowerCase();
      const handlers = commandHandlersRef.current;

      // Create note
      const noteMatch =
        cmd.match(/^(?:запиши|создай заметку|заметка|добавь заметку|новая заметка)[:\s]+(.+)/i);
      if (noteMatch) {
        const noteText = noteMatch[1].trim();
        try {
          const res = await fetch("/api/jarvis/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: noteText, content: noteText }),
          });
          const data = await res.json();
          if (data.note) {
            return { handled: true, response: `Заметка сохранена, сэр: «${noteText}»` };
          }
        } catch {
          /* ignore */
        }
        return { handled: true, response: "Не удалось сохранить заметку, сэр." };
      }

      // List notes
      if (/^(какие заметки|покажи заметк|список заметок|мои заметки|что в замет)/i.test(cmd)) {
        try {
          const res = await fetch("/api/jarvis/notes");
          const data = await res.json();
          const notes = data.notes ?? [];
          if (notes.length === 0) {
            return { handled: true, response: "У вас пока нет заметок, сэр." };
          }
          const lines = notes
            .slice(0, 10)
            .map(
              (n: { done: boolean; title: string }, i: number) =>
                `${n.done ? "\u2611" : "\u2610"} ${i + 1}. ${n.title}`
            )
            .join("\n");
          return {
            handled: true,
            response: `Ваши заметки (${notes.length}):\n${lines}${notes.length > 10 ? `\n\u2026 и ещё ${notes.length - 10}` : ""}`,
          };
        } catch {
          return { handled: true, response: "Не удалось загрузить заметки, сэр." };
        }
      }

      // Delete all notes
      if (/^(удали все заметки|удали заметки|очисти заметки|удали все задачи)/i.test(cmd)) {
        try {
          await fetch("/api/jarvis/notes", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: "all" }),
          });
          return { handled: true, response: "Все заметки удалены, сэр." };
        } catch {
          return { handled: true, response: "Не удалось удалить заметки, сэр." };
        }
      }

      // Timer
      const timerMatch = cmd.match(
        /(?:таймер|таймер на|поставь таймер|установи таймер|заведи таймер)\s+(\d+(?:[.,]\d+)?)\s*(?:минут|мин|minutes?|m|секунд|сек|seconds?|s)?/i
      );
      if (timerMatch) {
        const num = parseFloat(timerMatch[1].replace(",", "."));
        const hasSec = /секунд|сек|seconds?|s/i.test(cmd);
        const seconds = hasSec ? Math.round(num) : Math.round(num * 60);
        if (seconds > 0 && handlers.startTimer) {
          handlers.startTimer(seconds);
          const mins = Math.floor(seconds / 60);
          const secs = seconds % 60;
          const display = mins > 0 ? `${mins} мин${secs > 0 ? ` ${secs} сек` : ""}` : `${secs} сек`;
          return { handled: true, response: `Таймер установлен на ${display}, сэр.` };
        }
        return { handled: true, response: "Таймер недоступен, сэр." };
      }

      // Stop/reset timer
      if (/^(стоп таймер|сбрось таймер|останови таймер|отмени таймер)/i.test(cmd)) {
        if (handlers.stopTimer) handlers.stopTimer();
        if (handlers.resetTimer) handlers.resetTimer();
        return { handled: true, response: "Таймер остановлен, сэр." };
      }

      // Calculator
      if (/^(калькулятор|открой калькулятор|покажи калькулятор|посчитай)/i.test(cmd)) {
        if (handlers.toggleCalculator) handlers.toggleCalculator();
        return { handled: true, response: "Калькулятор активирован, сэр." };
      }

      // Notes
      if (/^(заметки|открой заметки|покажи заметки|мои записи)/i.test(cmd)) {
        if (handlers.openNotes) handlers.openNotes();
        return { handled: true, response: "Панель заметок открыта, сэр." };
      }

      // Fullscreen
      if (/^(полный экран|фуллскрин|во весь экран|fullscreen)/i.test(cmd)) {
        if (handlers.toggleFullscreen) handlers.toggleFullscreen();
        return { handled: true, response: "Полноэкранный режим активирован, сэр." };
      }

      // Settings
      if (/^(настройки|параметры|открой настройки|settings)/i.test(cmd)) {
        if (handlers.openSettings) handlers.openSettings();
        return { handled: true, response: "Панель настроек открыта, сэр." };
      }

      // Screen capture
      if (/^(скриншот|захват экрана|покажи экран|сделай скриншот|screen capture)/i.test(cmd)) {
        if (handlers.captureScreen) handlers.captureScreen();
        return { handled: true, response: "Инициализирую захват экрана, сэр." };
      }

      // Theme
      const themeMatch = cmd.match(/(?:марк|mark|тема|theme)\s+(1|42|50)/i);
      if (themeMatch) {
        const themeId = `mark-${themeMatch[1]}`;
        if (handlers.setTheme) handlers.setTheme(themeId);
        return { handled: true, response: `Костюм Mark ${themeMatch[1]} активирован, сэр.` };
      }

      // Mute/unmute
      if (/^(тихо|замолчи|молчи|выключи голос|mute)/i.test(cmd)) {
        useJarvisStore.getState().setAutoSpeakOn(false);
        return { handled: true, response: "Режим молчания активирован, сэр." };
      }
      if (/^(говори|голос|включи голос|звук|unmute)/i.test(cmd)) {
        useJarvisStore.getState().setAutoSpeakOn(true);
        return { handled: true, response: "Голосовой вывод восстановлен, сэр." };
      }

      // New chat — uses store directly, no TDZ issue
      if (/^(новый чат|новый разговор|очисти чат|новая сессия|новый диалог)/i.test(cmd)) {
        useJarvisStore.getState().clearChat();
        useJarvisStore.getState().setActiveConvoId(null);
        return { handled: true, response: "Новая сессия инициализирована, сэр." };
      }

      // Weather — delegate to LLM
      if (/^(погода|какая погода|прогноз|покажи погоду)/i.test(cmd)) {
        return { handled: false };
      }

      return null;
    },
    []
  );

  // ── Chat send (SSE streaming) ─────────────────────────────
  const sendText = useCallback(
    async (text: string, source: "voice" | "text" = "text") => {
      const { jarvisState, autoSpeakOn: aso } = useJarvisStore.getState();
      const clean = text.trim();
      if (!clean || jarvisState === "thinking" || jarvisState === "speaking") return;

      useJarvisStore.getState().setError(null);
      useJarvisStore.getState().setSearchedSources(null);
      stopSpeaking();

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: clean,
        createdAt: new Date().toISOString(),
        source,
      };
      useJarvisStore.getState().addMessage(userMsg);
      publishChatMessage({ messageId: userMsg.id, content: userMsg.content, isUser: true, charCount: userMsg.content.length });
      addActivityEvent({ severity: "info", category: "chat", message: `Сообщение отправлено: ${trunc(clean)}` });

      // Try local command processing first
      const cmdResult = await processCommand(clean);
      if (cmdResult?.handled) {
        playSound("command-ack");
        const reply = cmdResult.response || "Готово, сэр.";
        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
          hasAudio: true,
        };
        useJarvisStore.getState().addMessage(assistantMsg);
        if (aso) {
          await speak(reply);
        } else {
          useJarvisStore.getState().setJarvisState("idle");
        }
        return;
      }

      const pendingId = uid();
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        streaming: true,
      };
      useJarvisStore.getState().addMessage(pendingMsg);
      useJarvisStore.getState().setJarvisState("thinking");
      playSound("processing-start");

      const { messages: currentMessages, activeConvoId } = useJarvisStore.getState();
      const convoId = await ensureConversation(clean);
      const isFirst =
        currentMessages.filter((m) => m.role === "user").length === 0 && !activeConvoId;
      if (!isFirst && convoId) {
        void persistMessage("user", clean);
      }

      try {
        const history = currentMessages;

        const behavior = behaviorRef.current ? {
          persona: behaviorRef.current.persona as PersonaId,
          userName: behaviorRef.current.userName,
          formality: behaviorRef.current.formality,
          humor: behaviorRef.current.humor,
          responseStyle: behaviorRef.current.responseStyle as ResponseStyle,
          temperature: behaviorRef.current.temperature,
          maxTokens: behaviorRef.current.maxTokens,
          contextWindow: behaviorRef.current.contextWindow,
          customPrompt: behaviorRef.current.customPrompt,
        } : undefined;

        // ─── SSE Streaming ───
        const res = await fetch("/api/jarvis/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, query: clean, behavior }),
        });

        if (!res.ok) {
          let errMsg = "Ошибка связи с J.A.R.V.I.S.";
          try { errMsg = (await res.json()).error || errMsg; } catch { /* use default */ }
          throw new Error(errMsg);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("Нет тела ответа");

        const decoder = new TextDecoder();
        let fullContent = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload);
              if (parsed.error) throw new Error(parsed.error);
              if (parsed.search) {
                addActivityEvent({ severity: "info", category: "chat", message: "Веб-поиск активирован" });
              }
              if (parsed.chunk) {
                fullContent += parsed.chunk;
                useJarvisStore.getState().updateMessage(pendingId, { content: fullContent, streaming: true });
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
                throw e;
              }
            }
          }
        }

        // Finalize message
        if (!fullContent.trim()) {
          fullContent = "⚠️ Пустой ответ от модели. Попробуйте переформулировать запрос или перезапустить Ollama.";
          useJarvisStore.getState().updateMessage(pendingId, { content: fullContent, streaming: false });
          addActivityEvent({ severity: "warning", category: "chat", message: "Пустой ответ от модели (0 символов)" });
          useJarvisStore.getState().setJarvisState("idle");
          return;
        }

        useJarvisStore.getState().updateMessage(pendingId, { content: fullContent, streaming: false, hasAudio: true });
        publishChatMessage({ messageId: pendingId, content: fullContent, isUser: false, charCount: fullContent.length });

        if (convoId) void persistMessage("assistant", fullContent);

        addActivityEvent({ severity: "success", category: "chat", message: `Ответ получен (${fullContent.length} символов)` });

        if (aso) {
          await speak(fullContent);
        } else {
          useJarvisStore.getState().setJarvisState("idle");
        }
      } catch (e) {
        let msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED")) {
          msg = "Сервер Ollama не запущен. Запустите Ollama и загрузите модель: ollama pull llama3.1";
        } else if (msg.includes("OLLAMA_UNAVAILABLE")) {
          msg = msg.replace("OLLAMA_UNAVAILABLE: ", "");
        }
        useJarvisStore.getState().setError(msg);
        useJarvisStore.getState().setJarvisState("error");
        addActivityEvent({ severity: "error", category: "system", message: `Ошибка: ${trunc(msg, 35)}` });
        playSound("alert");
        useJarvisStore.getState().updateMessage(pendingId, { content: `» Ошибка: ${msg}`, pending: false });
      }
    },
    [ensureConversation, persistMessage, speak, stopSpeaking, processCommand]
  );

  // ── Voice recording (ASR) ────────────────────────────────

  const cleanupRecording = useCallback(() => {
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.abort(); } catch { /* ignore */ }
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    useJarvisStore.getState().setAudioLevel(0);
  }, []);

  const startListening = useCallback(async () => {
    const { isRecording: rec, jarvisState: st } = useJarvisStore.getState();
    if (rec || st === "thinking") return;
    useJarvisStore.getState().setError(null);
    stopSpeaking();

    // ─── Method 1: Browser Web Speech API (primary) ───
    const SpeechRecognition = getSpeechRecognition();
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "ru-RU";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;

        const levelInterval = setInterval(() => {
          useJarvisStore.getState().setAudioLevel((prev) => 0.3 + Math.random() * 0.5);
        }, 150);

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          clearInterval(levelInterval);
          useJarvisStore.getState().setAudioLevel(0);
          const transcript = event.results[0]?.[0]?.transcript?.trim();
          if (transcript) {
            addActivityEvent({ severity: "success", category: "voice", message: `Распознано: ${trunc(transcript)}` });
            useJarvisStore.getState().setIsRecording(false);
            useJarvisStore.getState().setJarvisState("idle");
            void sendText(transcript, "voice");
          } else {
            useJarvisStore.getState().setIsRecording(false);
            useJarvisStore.getState().setJarvisState("idle");
          }
        };

        recognition.onerror = (event) => {
          clearInterval(levelInterval);
          useJarvisStore.getState().setAudioLevel(0);
          useJarvisStore.getState().setIsRecording(false);
          if (event.error === "no-speech") {
            useJarvisStore.getState().setJarvisState("idle");
          } else if (event.error === "not-allowed") {
            useJarvisStore.getState().setError("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
            useJarvisStore.getState().setJarvisState("error");
          } else {
            useJarvisStore.getState().setError(`Ошибка распознавания: ${event.error}`);
            useJarvisStore.getState().setJarvisState("error");
          }
        };

        recognition.onend = () => {
          clearInterval(levelInterval);
          useJarvisStore.getState().setAudioLevel(0);
          useJarvisStore.getState().setIsRecording(false);
          const currentState = useJarvisStore.getState().jarvisState;
          if (currentState !== "thinking" && currentState !== "speaking") {
            useJarvisStore.getState().setJarvisState("idle");
          }
        };

        speechRecognitionRef.current = recognition;
        recognition.start();
        useJarvisStore.getState().setIsRecording(true);
        useJarvisStore.getState().setJarvisState("listening");
        addActivityEvent({ severity: "info", category: "voice", message: "Голосовой ввод активирован" });
        playSound("voice-activate");
        return;
      } catch (e) {
        console.error("SpeechRecognition failed, falling back to MediaRecorder:", e);
      }
    }

    // ─── Method 2: MediaRecorder + Server-side ZAI ASR (fallback) ───
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const sourceNode = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      sourceNode.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        useJarvisStore.getState().setAudioLevel(Math.min(1, avg / 90));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        cleanupRecording();
        useJarvisStore.getState().setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 200) {
          useJarvisStore.getState().setJarvisState("idle");
          return;
        }
        useJarvisStore.getState().setJarvisState("thinking");
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = reader.result as string;
            try {
              const res = await fetch("/api/jarvis/asr", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ audio: base64 }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "ASR failed");
              const text = (data.text || "").trim();
              if (text) {
                addActivityEvent({ severity: "success", category: "voice", message: `Распознано: ${trunc(text)}` });
                await sendText(text, "voice");
              } else {
                useJarvisStore.getState().setJarvisState("idle");
              }
            } catch (err) {
              useJarvisStore.getState().setError(err instanceof Error ? err.message : "Распознавание не удалось");
              useJarvisStore.getState().setJarvisState("error");
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          useJarvisStore.getState().setError(err instanceof Error ? err.message : "Ошибка записи");
          useJarvisStore.getState().setJarvisState("error");
        }
      };

      mr.start();
      useJarvisStore.getState().setIsRecording(true);
      useJarvisStore.getState().setJarvisState("listening");
      addActivityEvent({ severity: "info", category: "voice", message: "Голосовой ввод активирован" });
    } catch (e) {
      useJarvisStore.getState().setError(
        e instanceof Error
          ? `Нет доступа к микрофону: ${e.message}`
          : "Микрофон недоступен"
      );
      useJarvisStore.getState().setJarvisState("error");
      cleanupRecording();
    }
  }, [sendText, stopSpeaking, cleanupRecording]);

  const stopListening = useCallback(() => {
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch { /* ignore */ }
    }
    const { isRecording: rec } = useJarvisStore.getState();
    if (mediaRecorderRef.current && rec) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    const { isRecording: rec } = useJarvisStore.getState();
    if (rec) stopListening();
    else void startListening();
  }, [startListening, stopListening]);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
      const synth = window.speechSynthesis;
      if (synth) synth.cancel();
    };
  }, [cleanupRecording]);

  // load conversations on mount
  useEffect(() => {
    let cancelled = false;
    loadConversations().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [loadConversations]);

  // ── Vision (VLM) ─────────────────────────────────────────
  const analyzeImage = useCallback(
    async (file: File, textPrompt?: string) => {
      const { jarvisState: st, autoSpeakOn: aso } = useJarvisStore.getState();
      if (st === "thinking" || st === "speaking") return;
      useJarvisStore.getState().setError(null);
      useJarvisStore.getState().setSearchedSources(null);
      stopSpeaking();
      useJarvisStore.getState().setJarvisState("thinking");
      addActivityEvent({ severity: "info", category: "vision", message: "Анализ изображения..." });

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: textPrompt || "Проанализируй это изображение",
        createdAt: new Date().toISOString(),
        source: "text",
        imagePreview: URL.createObjectURL(file),
      };
      useJarvisStore.getState().addMessage(userMsg);
      publishChatMessage({ messageId: userMsg.id, content: userMsg.content, isUser: true, charCount: userMsg.content.length });

      const pendingId = uid();
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      useJarvisStore.getState().addMessage(pendingMsg);

      const { messages: currentMessages, activeConvoId } = useJarvisStore.getState();
      const convoId = await ensureConversation(userMsg.content);
      if (convoId && currentMessages.filter((m) => m.role === "user").length > 0) {
        void persistMessage("user", userMsg.content);
      }

      try {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const res = await fetch("/api/jarvis/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, prompt: textPrompt }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка анализа изображения.");

        const reply = data.reply as string;
        useJarvisStore.getState().updateMessage(pendingId, { content: reply, pending: false, hasAudio: true });

        if (convoId) void persistMessage("assistant", reply);

        addActivityEvent({ severity: "success", category: "vision", message: "Анализ изображения завершён" });

        if (aso) {
          await speak(reply);
        } else {
          useJarvisStore.getState().setJarvisState("idle");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        useJarvisStore.getState().setError(msg);
        useJarvisStore.getState().setJarvisState("error");
        addActivityEvent({ severity: "error", category: "system", message: `Ошибка: ${trunc(msg, 35)}` });
        useJarvisStore.getState().updateMessage(pendingId, { content: `» Ошибка: ${msg}`, pending: false });
      }
    },
    [ensureConversation, persistMessage, speak, stopSpeaking]
  );

  // ── Continuous Listen Mode ───────────────────────────────
  const toggleContinuousMode = useCallback(() => {
    const next = !useJarvisStore.getState().continuousMode;
    playSound(next ? "activate" : "deactivate");
    useJarvisStore.getState().setContinuousMode(next);
  }, []);

  // Auto-listen after speaking ends when continuous mode is on
  useEffect(() => {
    const { continuousMode: cm, jarvisState: st, isRecording: rec, messages: msgs } = useJarvisStore.getState();
    if (!cm || st !== "idle" || rec || msgs.length === 0) return;
    const timer = setTimeout(() => {
      void startListening();
    }, 500);
    return () => clearTimeout(timer);
  }, [jarvisState, isRecording, messages.length, startListening]);

  // ── Screen Capture + VLM ────────────────────────────────
  const captureScreen = useCallback(
    async (customPrompt?: string) => {
      const { jarvisState: st } = useJarvisStore.getState();
      if (st === "thinking" || st === "speaking") return;
      addActivityEvent({ severity: "info", category: "vision", message: "Захват экрана..." });

      try {
        playSound("scan");
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

        const video = document.createElement("video");
        video.srcObject = stream;
        video.muted = true;

        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play().then(resolve).catch(reject);
          };
          video.onerror = reject;
          setTimeout(() => reject(new Error("Timeout waiting for video")), 5000);
        });

        await new Promise((r) => setTimeout(r, 200));

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context unavailable");
        ctx.drawImage(video, 0, 0);

        stream.getTracks().forEach((t) => t.stop());

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

        const parts = dataUrl.split(",");
        const b64 = atob(parts[1]);
        const arr = new Uint8Array(b64.length);
        for (let i = 0; i < b64.length; i++) arr[i] = b64.charCodeAt(i);
        const blob = new Blob([arr], { type: "image/jpeg" });
        const file = new File([blob], "screen-capture.jpg", { type: "image/jpeg" });

        const prompt = customPrompt?.trim()
          ? `На этом скриншоте экрана: ${customPrompt.trim()}`
          : "Опиши что видишь на этом экране. Детально.";
        await analyzeImage(file, prompt);
      } catch (e) {
        if (e instanceof DOMException && e.name === "NotAllowedError") return;
        const msg = e instanceof Error ? e.message : "Ошибка захвата экрана";
        useJarvisStore.getState().setError(msg);
        useJarvisStore.getState().setJarvisState("error");
      }
    },
    [analyzeImage]
  );

  // ── Image Generation ─────────────────────────────────────
  const generateImage = useCallback(
    async (prompt: string) => {
      const { jarvisState: st, messages: currentMessages, activeConvoId } = useJarvisStore.getState();
      if (st === "thinking" || st === "speaking") return;
      useJarvisStore.getState().setError(null);
      useJarvisStore.getState().setSearchedSources(null);
      stopSpeaking();
      useJarvisStore.getState().setJarvisState("thinking");

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: `Сгенерируй изображение: ${prompt}`,
        createdAt: new Date().toISOString(),
        source: "text",
      };
      useJarvisStore.getState().addMessage(userMsg);
      publishChatMessage({ messageId: userMsg.id, content: userMsg.content, isUser: true, charCount: userMsg.content.length });

      const pendingId = uid();
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      useJarvisStore.getState().addMessage(pendingMsg);

      const convoId = await ensureConversation(userMsg.content);
      if (convoId && currentMessages.filter((m) => m.role === "user").length > 0) {
        void persistMessage("user", userMsg.content);
      }

      try {
        const res = await fetch("/api/jarvis/image-gen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, size: "1024x1024" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка генерации изображения.");

        const imageUrl = data.image as string;
        const reply = `Вот изображение по запросу: «${prompt}»`;
        useJarvisStore.getState().updateMessage(pendingId, { content: reply, pending: false, generatedImage: imageUrl, hasAudio: false });

        if (convoId) void persistMessage("assistant", reply);
        useJarvisStore.getState().setJarvisState("idle");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        useJarvisStore.getState().setError(msg);
        useJarvisStore.getState().setJarvisState("error");
        useJarvisStore.getState().updateMessage(pendingId, { content: `» Ошибка: ${msg}`, pending: false });
      }
    },
    [ensureConversation, persistMessage, stopSpeaking]
  );

  // ── Public API (same shape as before) ────────────────────
  return {
    // state
    messages,
    state: jarvisState,
    error,
    audioLevel,
    isRecording,
    autoSpeakOn,
    searchedSources,
    conversations,
    activeConvoId,
    processCommand,
    // actions
    sendText,
    analyzeImage,
    generateImage,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    setAutoSpeakOn: (v: boolean) => useJarvisStore.getState().setAutoSpeakOn(v),
    updateTTSSettings: (rate: number, pitch: number, vol: number) => {
      ttsRateRef.current = rate;
      ttsPitchRef.current = pitch;
      volumeRef.current = vol;
    },
    clearMessages: () => useJarvisStore.getState().clearChat(),
    newConversation,
    selectConversation,
    deleteConversation,
    loadConversations,
    setCommandHandlers: (h: CommandHandlers) => { commandHandlersRef.current = h; },
    // Continuous listen mode
    continuousMode,
    setContinuousMode: (v: boolean) => useJarvisStore.getState().setContinuousMode(v),
    toggleContinuousMode,
    // Screen capture (feature-detected)
    ...(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia
      ? { captureScreen }
      : {}),
  };
}

/** Parse timer seconds from natural text (for external use) */
export function parseTimerSeconds(text: string): number | null {
  const cmd = text.trim().toLowerCase();
  const match = cmd.match(
    /(?:таймер|таймер на|поставь таймер|установи таймер|заведи таймер)\s+(\d+(?:[.,]\d+)?)\s*(?:минут|мин|minutes?|m|секунд|сек|seconds?|s)?/i
  );
  if (!match) return null;
  const num = parseFloat(match[1].replace(",", "."));
  const hasSec = /секунд|сек|seconds?|s/i.test(cmd);
  return hasSec ? Math.round(num) : Math.round(num * 60);
}