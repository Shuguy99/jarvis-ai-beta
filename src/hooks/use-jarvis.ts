"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, Conversation } from "@/lib/types";

export type JarvisState = "idle" | "listening" | "thinking" | "speaking" | "error";

interface Source {
  name: string;
  url: string;
  host_name?: string;
}

interface UseJarvisOptions {
  autoSpeak?: boolean;
  volume?: number;
  ttsRate?: number;
  ttsPitch?: number;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * Picks the best Russian voice from available browser SpeechSynthesis voices.
 * Priority: Microsoft Irina/ Pavel > Google русский > Yandex > any ru-RU > any ru_*
 */
function pickRussianVoice(): SpeechSynthesisVoice | null {
  const synth = window.speechSynthesis;
  if (!synth) return null;
  const voices = synth.getVoices();
  if (!voices.length) return null;

  const ruVoices = voices.filter((v) => v.lang.startsWith("ru"));
  if (!ruVoices.length) return null;

  // Prefer specific high-quality Russian voices
  const preferred = ["Microsoft Irina", "Microsoft Pavel", "Google русский", "Yandex"];
  for (const name of preferred) {
    const found = ruVoices.find((v) => v.name.includes(name));
    if (found) return found;
  }

  // Prefer ru-RU exact match, then local voices, then any ru
  const exact = ruVoices.find((v) => v.lang === "ru-RU");
  if (exact) return exact;
  const local = ruVoices.find((v) => v.localService);
  if (local) return local;
  return ruVoices[0];
}

export function useJarvis(opts: UseJarvisOptions = {}) {
  const { autoSpeak = true, volume = 1.0, ttsRate = 1.05, ttsPitch = 0.95 } = opts;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [state, setState] = useState<JarvisState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [autoSpeakOn, setAutoSpeakOn] = useState(autoSpeak);
  const [searchedSources, setSearchedSources] = useState<Source[] | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingAbortRef = useRef<boolean>(false);
  const russianVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

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

  // Preload Russian voice on mount
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
      utterance.rate = ttsRate;
      utterance.pitch = ttsPitch;
      utterance.volume = volume;

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

      // Chrome workaround: long text can stop mid-speech — resume on pause
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
    [ttsRate, ttsPitch, volume]
  );

  // ---- Chat send ----
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

      // persist user message (creates conversation if needed)
      const convoId = await ensureConversation(clean);
      if (convoId) {
        // ensureConversation already stored the first message; for subsequent, store here
        // but it only stores first, so we always persist
        // Actually ensureConversation stored `clean` as first message when creating.
        // If convo already existed, we need to persist.
        // Simplest: always persist, accept possible first-message duplicate by checking.
      }
      // Persist user message (covers both new and existing convos). For new convo,
      // the create endpoint already saved it, so skip the very first one.
      const isFirst =
        messages.filter((m) => m.role === "user").length === 0 && !activeConvoId;
      if (!isFirst && convoId) {
        void persistMessage("user", clean);
      }

      try {
        const history = messages; // state snapshot before pending
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
    [state, messages, activeConvoId, ensureConversation, persistMessage, autoSpeakOn, speak, stopSpeaking]
  );

  // ---- Voice recording (ASR) ----
  const cleanupRecording = useCallback(() => {
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // analyser for visualizer
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

      // persist
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
    clearMessages,
    newConversation,
    selectConversation,
    deleteConversation,
    loadConversations,
  };
}

export type UseJarvisReturn = ReturnType<typeof useJarvis>;
