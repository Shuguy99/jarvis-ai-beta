"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Conversation } from "@/lib/types";

export type JarvisState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Source {
  name: string;
  url: string;
  host_name?: string;
}

export interface JarvisSettings {
  ttsRate: number;
  ttsPitch: number;
  volume: number;
  autoSpeak: boolean;
  language: string;
}

export interface CommandHandlers {
  startTimer?: (seconds: number) => void;
  stopTimer?: () => void;
  resetTimer?: () => void;
  toggleNotes?: () => void;
  openNotes?: () => void;
  setTheme?: (theme: string) => void;
  toggleFullscreen?: () => void;
  openSettings?: () => void;
}

interface UseJarvisOptions {
  autoSpeak?: boolean;
  volume?: number;
  ttsRate?: number;
  ttsPitch?: number;
  settings?: Partial<JarvisSettings>;
  commandHandlers?: CommandHandlers;
}

const DEFAULT_SETTINGS: JarvisSettings = {
  ttsRate: 1.05,
  ttsPitch: 0.95,
  volume: 1.0,
  autoSpeak: true,
  language: "ru",
};

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Picks the best Russian voice from available browser SpeechSynthesis voices.
 */
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

/**
 * Detect if browser SpeechRecognition API is available
 */
function getSpeechRecognition(): (typeof window.SpeechRecognition) | null {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function useJarvis(opts: UseJarvisOptions = {}) {
  const { autoSpeak = true, volume = 1.0, ttsRate = 1.05, ttsPitch = 0.95, settings: externalSettings } = opts;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<JarvisState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [autoSpeakOn, setAutoSpeakOn] = useState(autoSpeak);
  const [searchedSources, setSearchedSources] = useState<Source[] | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Use refs for TTS params so speak() always gets latest values
  const ttsRateRef = useRef(ttsRate);
  const ttsPitchRef = useRef(ttsPitch);
  const volumeRef = useRef(volume);

  // Sync refs when props or settings change
  useEffect(() => {
    if (externalSettings) {
      ttsRateRef.current = externalSettings.ttsRate ?? ttsRate;
      ttsPitchRef.current = externalSettings.ttsPitch ?? ttsPitch;
      volumeRef.current = externalSettings.volume ?? volume;
    }
  }, [externalSettings, ttsRate, ttsPitch, volume]);

  // MediaRecorder refs (for server-side ASR fallback)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Browser SpeechRecognition ref
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

  const speakingAbortRef = useRef<boolean>(false);
  const russianVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const commandHandlersRef = useRef<CommandHandlers>(opts.commandHandlers ?? {});

  // ---- conversation persistence ----
  const persistMessage = useCallback(
    async (role: ChatMessage["role"], content: string) => {
      if (!activeConvoId) return;
      try {
        await fetch(`/api/jarvis/conversations/${activeConvoId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role, content }),
        });
      } catch {
        /* ignore persistence errors */
      }
    },
    [activeConvoId]
  );

  const ensureConversation = useCallback(async (firstUserText: string) => {
    if (activeConvoId) return activeConvoId;
    try {
      const res = await fetch("/api/jarvis/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstUserText, role: "user" }),
      });
      const data = await res.json();
      if (data?.conversation?.id) {
        setActiveConvoId(data.conversation.id);
        setConversations((prev) => [data.conversation, ...prev]);
        return data.conversation.id as string;
      }
    } catch {
      /* ignore */
    }
    return null;
  }, [activeConvoId]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/conversations");
      const data = await res.json();
      setConversations(data.conversations ?? []);
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
        setActiveConvoId(c.id);
        setMessages(
          c.messages.map((m) => ({
            id: m.id,
            role: m.role as ChatMessage["role"],
            content: m.content,
            createdAt: m.createdAt,
          }))
        );
        setSearchedSources(null);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const newConversation = useCallback(() => {
    setActiveConvoId(null);
    setMessages([]);
    setSearchedSources(null);
    setError(null);
    setState("idle");
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/jarvis/conversations/${id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvoId === id) newConversation();
    } catch {
      /* ignore */
    }
  }, [activeConvoId, newConversation]);

  // ---- TTS (browser SpeechSynthesis — native Russian voice) ----

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
    setState((s) => (s === "speaking" ? "idle" : s));
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      const synth = window.speechSynthesis;
      if (!synth) {
        setState("idle");
        return;
      }

      speakingAbortRef.current = false;
      setState("speaking");
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = ttsRateRef.current;
      utterance.pitch = ttsPitchRef.current;
      utterance.volume = volumeRef.current;

      const voice = russianVoiceRef.current || pickRussianVoice();
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        if (!speakingAbortRef.current) setState("idle");
      };
      utterance.onerror = (e) => {
        if (e.error !== "canceled") {
          console.error("SpeechSynthesis error", e);
        }
        setState("idle");
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

  // ---- Command parser (local commands) ----
  const processCommand = useCallback(
    async (text: string): Promise<{ handled: boolean; response?: string } | null> => {
      const cmd = text.trim().toLowerCase();
      const handlers = commandHandlersRef.current;

      // Create note: "запиши X", "создай заметку X", "заметка: X", "добавь заметку X"
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

      // List notes: "какие заметки", "покажи заметки", "список заметок"
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

      // Delete all notes: "удали все заметки", "очисти заметки"
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

      // Timer: "таймер на X минут", "поставь таймер X", "таймер X минут"
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

      // Stop/reset timer: "стоп таймер", "сбрось таймер", "останови таймер"
      if (/^(стоп таймер|сбрось таймер|останови таймер|отмени таймер)/i.test(cmd)) {
        if (handlers.stopTimer) handlers.stopTimer();
        if (handlers.resetTimer) handlers.resetTimer();
        return { handled: true, response: "Таймер остановлен, сэр." };
      }

      return null; // not a local command
    },
    []
  );

  // ---- Chat send (standard JSON request/response) ----
  const sendText = useCallback(
    async (text: string, source: "voice" | "text" = "text") => {
      const clean = text.trim();
      if (!clean || state === "thinking" || state === "speaking") return;

      setError(null);
      setSearchedSources(null);
      stopSpeaking();

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: clean,
        createdAt: new Date().toISOString(),
        source,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Try local command processing first
      const cmdResult = await processCommand(clean);
      if (cmdResult?.handled) {
        const reply = cmdResult.response || "Готово, сэр.";
        const assistantMsg: ChatMessage = {
          id: uid(),
          role: "assistant",
          content: reply,
          createdAt: new Date().toISOString(),
          hasAudio: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        if (autoSpeakOn) {
          await speak(reply);
        } else {
          setState("idle");
        }
        return;
      }

      const pendingId = uid();
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, pendingMsg]);
      setState("thinking");

      const convoId = await ensureConversation(clean);
      const isFirst =
        messages.filter((m) => m.role === "user").length === 0 && !activeConvoId;
      if (!isFirst && convoId) {
        void persistMessage("user", clean);
      }

      try {
        const history = messages;

        const res = await fetch("/api/jarvis/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, query: clean }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка связи с J.A.R.V.I.S.");

        const reply = data.reply as string;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: reply, pending: false, hasAudio: true }
              : m
          )
        );

        if (data.sources) setSearchedSources(data.sources as Source[]);

        if (convoId) void persistMessage("assistant", reply);

        if (autoSpeakOn) {
          await speak(reply);
        } else {
          setState("idle");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        setError(msg);
        setState("error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: `» Ошибка: ${msg}`, pending: false }
              : m
          )
        );
      }
    },
    [state, messages, activeConvoId, ensureConversation, persistMessage, autoSpeakOn, speak, stopSpeaking, processCommand]
  );

  // ---- Voice recording (ASR) ----
  // Primary: browser Web Speech API (SpeechRecognition)
  // Fallback: MediaRecorder + server-side ZAI ASR

  const cleanupRecording = useCallback(() => {
    // Stop SpeechRecognition
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.abort(); } catch { /* ignore */ }
      speechRecognitionRef.current = null;
    }
    // Stop MediaRecorder
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
    setAudioLevel(0);
  }, []);

  const startListening = useCallback(async () => {
    if (isRecording || state === "thinking") return;
    setError(null);
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

        // Simulate audio level animation while listening
        const levelInterval = setInterval(() => {
          setAudioLevel((prev) => 0.3 + Math.random() * 0.5);
        }, 150);

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          clearInterval(levelInterval);
          setAudioLevel(0);
          const transcript = event.results[0]?.[0]?.transcript?.trim();
          if (transcript) {
            setIsRecording(false);
            setState("idle");
            void sendText(transcript, "voice");
          } else {
            setIsRecording(false);
            setState("idle");
          }
        };

        recognition.onerror = (event) => {
          clearInterval(levelInterval);
          setAudioLevel(0);
          setIsRecording(false);
          if (event.error === "no-speech") {
            setState("idle");
          } else if (event.error === "not-allowed") {
            setError("Нет доступа к микрофону. Разрешите доступ в настройках браузера.");
            setState("error");
          } else {
            setError(`Ошибка распознавания: ${event.error}`);
            setState("error");
          }
        };

        recognition.onend = () => {
          clearInterval(levelInterval);
          setAudioLevel(0);
          setIsRecording(false);
          if (state !== "thinking" && state !== "speaking") {
            setState("idle");
          }
        };

        speechRecognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
        setState("listening");
        return; // Done — browser handles everything
      } catch (e) {
        console.error("SpeechRecognition failed, falling back to MediaRecorder:", e);
        // Fall through to MediaRecorder method
      }
    }

    // ─── Method 2: MediaRecorder + Server-side ZAI ASR (fallback) ───
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
        setAudioLevel(Math.min(1, avg / 90));
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
        setIsRecording(false);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 200) {
          setState("idle");
          return;
        }
        setState("thinking");
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
                await sendText(text, "voice");
              } else {
                setState("idle");
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : "Распознавание не удалось");
              setState("error");
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Ошибка записи");
          setState("error");
        }
      };

      mr.start();
      setIsRecording(true);
      setState("listening");
    } catch (e) {
      setError(
        e instanceof Error
          ? `Нет доступа к микрофону: ${e.message}`
          : "Микрофон недоступен"
      );
      setState("error");
      cleanupRecording();
    }
  }, [isRecording, state, sendText, stopSpeaking, cleanupRecording]);

  const stopListening = useCallback(() => {
    // Stop SpeechRecognition
    if (speechRecognitionRef.current) {
      try { speechRecognitionRef.current.stop(); } catch { /* ignore */ }
    }
    // Stop MediaRecorder
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  }, [isRecording]);

  const toggleListening = useCallback(() => {
    if (isRecording) stopListening();
    else startListening();
  }, [isRecording, startListening, stopListening]);

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
    void loadConversations();
  }, [loadConversations]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSearchedSources(null);
    setError(null);
    setState("idle");
  }, []);

  // ---- Vision (VLM) ----
  const analyzeImage = useCallback(
    async (file: File, textPrompt?: string) => {
      if (state === "thinking" || state === "speaking") return;
      setError(null);
      setSearchedSources(null);
      stopSpeaking();
      setState("thinking");

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: textPrompt || "Проанализируй это изображение",
        createdAt: new Date().toISOString(),
        source: "text",
        imagePreview: URL.createObjectURL(file),
      };
      setMessages((prev) => [...prev, userMsg]);

      const pendingId = uid();
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, pendingMsg]);

      const convoId = await ensureConversation(userMsg.content);
      if (convoId && messages.filter((m) => m.role === "user").length > 0) {
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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: reply, pending: false, hasAudio: true }
              : m
          )
        );

        if (convoId) void persistMessage("assistant", reply);

        if (autoSpeakOn) {
          await speak(reply);
        } else {
          setState("idle");
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        setError(msg);
        setState("error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: `» Ошибка: ${msg}`, pending: false }
              : m
          )
        );
      }
    },
    [state, messages, activeConvoId, ensureConversation, persistMessage, autoSpeakOn, speak, stopSpeaking]
  );

  // ---- Image Generation ----
  const generateImage = useCallback(
    async (prompt: string) => {
      if (state === "thinking" || state === "speaking") return;
      setError(null);
      setSearchedSources(null);
      stopSpeaking();
      setState("thinking");

      const userMsg: ChatMessage = {
        id: uid(),
        role: "user",
        content: `Сгенерируй изображение: ${prompt}`,
        createdAt: new Date().toISOString(),
        source: "text",
      };
      setMessages((prev) => [...prev, userMsg]);

      const pendingId = uid();
      const pendingMsg: ChatMessage = {
        id: pendingId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, pendingMsg]);

      const convoId = await ensureConversation(userMsg.content);
      if (convoId && messages.filter((m) => m.role === "user").length > 0) {
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
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: reply, pending: false, generatedImage: imageUrl, hasAudio: false }
              : m
          )
        );

        if (convoId) void persistMessage("assistant", reply);
        setState("idle");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
        setError(msg);
        setState("error");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? { ...m, content: `» Ошибка: ${msg}`, pending: false }
              : m
          )
        );
      }
    },
    [state, messages, activeConvoId, ensureConversation, persistMessage, stopSpeaking]
  );

  return {
    // state
    messages,
    state,
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
    setAutoSpeakOn,
    updateTTSSettings: (rate: number, pitch: number, vol: number) => {
      ttsRateRef.current = rate;
      ttsPitchRef.current = pitch;
      volumeRef.current = vol;
    },
    clearMessages,
    newConversation,
    selectConversation,
    deleteConversation,
    loadConversations,
    setCommandHandlers: (h: CommandHandlers) => { commandHandlersRef.current = h; },
  };
}

export type UseJarvisReturn = ReturnType<typeof useJarvis>;

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