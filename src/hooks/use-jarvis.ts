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
  voice?: string;
  speed?: number;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function useJarvis(opts: UseJarvisOptions = {}) {
  const { autoSpeak = true, voice = "tongtong", speed = 1.0 } = opts;

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
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const speakingAbortRef = useRef<boolean>(false);

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

  // ---- TTS ----
  const stopSpeaking = useCallback(() => {
    speakingAbortRef.current = true;
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = "";
    }
    setState((s) => (s === "speaking" ? "idle" : s));
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      speakingAbortRef.current = false;
      setState("speaking");
      try {
        const res = await fetch("/api/jarvis/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice, speed }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioElRef.current) {
          audioElRef.current.pause();
        }
        const audio = new Audio(url);
        audioElRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (!speakingAbortRef.current) setState("idle");
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setState("idle");
        };
        await audio.play().catch(() => setState("idle"));
      } catch (e) {
        console.error("TTS error", e);
        setState("idle");
      }
    },
    [voice, speed]
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
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
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
