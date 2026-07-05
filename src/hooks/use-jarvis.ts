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
import { parseTaskPlanFromAI, generatePlanPrompt } from "@/lib/task-planner";
import { useUIStore } from "@/lib/ui-store";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { publishChatMessage } from "@/lib/context-bus";
import { useTTS } from "@/hooks/use-tts";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import { processLocalCommand } from "@/hooks/use-local-commands";
import { auditLog } from "@/lib/security-audit";

/** 20% chance to attach a mood emoji based on message content */
function detectMoodEmoji(text: string): string | undefined {
  if (Math.random() > 0.2) return undefined;
  const lower = text.toLowerCase();
  if (/ошибка|проблема|не удалось/.test(lower)) return "😔";
  if (/успешно|готово|выполнено/.test(lower)) return "✅";
  if (/\?|интересно|любопытно/.test(lower)) return "🤔";
  if (text.length > 500 && /```/.test(text)) return "💻";
  return undefined;
}

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
  const continuousMode = useJarvisStore((s) => s.continuousMode);

  // ── Browser-only refs ─────────────────────────────────────
  const behaviorRef = useRef<Partial<JarvisSettings>>({});
  const commandHandlersRef = useRef<CommandHandlers>(opts.commandHandlers ?? {});

  // Sync behavior ref when settings change
  useEffect(() => {
    if (externalSettings) {
      behaviorRef.current = externalSettings;
    }
  }, [externalSettings]);

  // ── TTS (extracted hook) ──────────────────────────────────
  const { speak, stopSpeaking, updateTTSSettings } = useTTS({
    ttsRate,
    ttsPitch,
    volume,
  });

  // ── Conversation persistence ──────────────────────────────

  const persistMessage = useCallback(
    async (role: ChatMessage["role"], content: string) => {
      // Incognito mode: skip database persistence
      if (useUIStore.getState().incognitoMode) return;
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
    // Incognito mode: skip conversation creation
    if (useUIStore.getState().incognitoMode) return null;
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

  // ── Command parser (local commands, extracted) ────────────
  const processCommand = useCallback(
    async (text: string) => processLocalCommand(text, commandHandlersRef.current),
    []
  );

  // ── Chat send (SSE streaming) ─────────────────────────────
  const sendText = useCallback(
    async (text: string, source: "voice" | "text" = "text", imageBase64?: string) => {
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
        ...(imageBase64 ? {
          imageAttachments: [{ id: uid(), dataUrl: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}`, name: "image" }],
        } : {}),
      };
      useJarvisStore.getState().addMessage(userMsg);
      publishChatMessage({ messageId: userMsg.id, content: userMsg.content, isUser: true, charCount: userMsg.content.length });
      addActivityEvent({ severity: "info", category: "chat", message: `Сообщение отправлено: ${trunc(clean)}` });
      auditLog("settings_change", "Отправлено сообщение", `Source: ${source}`);

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
        const isPlanRequest = clean.match(/^(спланируй|plan|запланируй|составь план)/i);
        const effectiveQuery = isPlanRequest ? generatePlanPrompt(clean) : clean;
        const voicePersonaId = useUIStore.getState().activePersonaId;
        const res = await fetch("/api/jarvis/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, query: effectiveQuery, behavior, voicePersonaId, ...(imageBase64 ? { imageBase64 } : {}) }),
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

        const moodEmoji = detectMoodEmoji(fullContent);
        useJarvisStore.getState().updateMessage(pendingId, { content: fullContent, streaming: false, hasAudio: true, moodEmoji });
        publishChatMessage({ messageId: pendingId, content: fullContent, isUser: false, charCount: fullContent.length });

        // Task planner: detect planning requests and parse AI response
        if (clean.match(/^(спланируй|plan|запланируй|составь план)/i)) {
          const plan = parseTaskPlanFromAI(clean, fullContent);
          if (plan.tasks.length > 0) {
            useJarvisStore.getState().setTaskPlan(plan);
          }
        }

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

  // ── Voice recording (extracted hook) ──────────────────────
  const {
    isRecording,
    audioLevel,
    startListening,
    stopListening,
    toggleListening,
  } = useVoiceRecorder({ sendText, stopSpeaking });

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
        const moodEmoji = detectMoodEmoji(reply);
        useJarvisStore.getState().updateMessage(pendingId, { content: reply, pending: false, hasAudio: true, moodEmoji });

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
    updateTTSSettings,
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