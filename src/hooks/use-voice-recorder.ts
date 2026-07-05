import { useCallback, useEffect, useRef } from "react";
import { useJarvisStore, trunc } from "@/lib/jarvis-store";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

// ── Browser-API helper ──────────────────────────────────────

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ── Hook options ─────────────────────────────────────────────

export interface UseVoiceRecorderOptions {
  sendText: (text: string, source: "voice" | "text") => Promise<void>;
  stopSpeaking: () => void;
}

// ── Hook ─────────────────────────────────────────────────────

export function useVoiceRecorder({ sendText, stopSpeaking }: UseVoiceRecorderOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

  const isRecording = useJarvisStore((s) => s.isRecording);
  const audioLevel = useJarvisStore((s) => s.audioLevel);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
      const synth = window.speechSynthesis;
      if (synth) synth.cancel();
    };
  }, [cleanupRecording]);

  return { isRecording, audioLevel, startListening, stopListening, toggleListening, cleanup: cleanupRecording };
}