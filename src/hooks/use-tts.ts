import { useCallback, useEffect, useRef } from "react";
import { useJarvisStore } from "@/lib/jarvis-store";
import { useUIStore } from "@/lib/ui-store";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

// ── Voice picker helper ──────────────────────────────────────

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

// ── Hook options ─────────────────────────────────────────────

export interface UseTTSOptions {
  ttsRate?: number;
  ttsPitch?: number;
  volume?: number;
}

// ── Hook ─────────────────────────────────────────────────────

export function useTTS(opts: UseTTSOptions = {}) {
  const { ttsRate = 1.05, ttsPitch = 0.95, volume = 1.0 } = opts;

  const speakingAbortRef = useRef(false);
  const russianVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const ttsRateRef = useRef(ttsRate);
  const ttsPitchRef = useRef(ttsPitch);
  const volumeRef = useRef(volume);

  // Sync refs when options change
  useEffect(() => {
    ttsRateRef.current = opts.ttsRate ?? ttsRate;
    ttsPitchRef.current = opts.ttsPitch ?? ttsPitch;
    volumeRef.current = opts.volume ?? volume;
  }, [opts.ttsRate, opts.ttsPitch, opts.volume, ttsRate, ttsPitch, volume]);

  // Load Russian voice on mount
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

  // Derive isSpeaking from store state
  const jarvisState = useJarvisStore((s) => s.jarvisState);
  const isSpeaking = jarvisState === "speaking";

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
      // Do Not Disturb mode: skip TTS auto-speak
      if (useUIStore.getState().quietMode) {
        useJarvisStore.getState().setJarvisState("idle");
        return;
      }
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

  const updateTTSSettings = useCallback((rate: number, pitch: number, vol: number) => {
    ttsRateRef.current = rate;
    ttsPitchRef.current = pitch;
    volumeRef.current = vol;
  }, []);

  return { speak, stopSpeaking, isSpeaking, updateTTSSettings };
}