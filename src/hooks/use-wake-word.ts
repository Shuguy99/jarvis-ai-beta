"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playSound } from "@/lib/sounds";

interface UseWakeWordOptions {
  enabled?: boolean;
  onWakeWord: () => void;
}

/** Wake phrases in lowercase for comparison */
const WAKE_PHRASES = [
  "привет джарвис",
  "hey jarvis",
  "джарвис",
  "jarvis",
  "привет Jarvis",
  "hey Jarvis",
  "Jarvis",
  "Джарвис",
];

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function isWakePhrase(transcript: string): boolean {
  const normalized = transcript.toLowerCase().trim();
  if (!normalized) return false;

  for (const phrase of WAKE_PHRASES) {
    const p = phrase.toLowerCase().trim();
    if (p.length <= 8) {
      // Short phrase: must be at start or match exactly
      if (normalized.startsWith(p) || normalized === p) return true;
    } else {
      // Longer phrase: can appear anywhere
      if (normalized.includes(p)) return true;
    }
  }
  return false;
}

export function useWakeWord({ enabled = false, onWakeWord }: UseWakeWordOptions) {
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const cooldownRef = useRef(false);
  const onWakeWordRef = useRef(onWakeWord);
  const enabledRef = useRef(enabled);
  const startFnRef = useRef<() => void>(() => {});

  // Keep refs up to date
  useEffect(() => {
    onWakeWordRef.current = onWakeWord;
  }, [onWakeWord]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const abortRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRecognition();
    // State will be updated by onend/onerror callbacks, but force it too
    setIsListening(false);
    setIsActive(false);
  }, [abortRecognition]);

  const restartAfterCooldown = useCallback(() => {
    cooldownRef.current = false;
    if (enabledRef.current) {
      startFnRef.current();
    }
  }, []);

  const restartOnError = useCallback(() => {
    if (enabledRef.current) {
      startFnRef.current();
    }
  }, []);

  const restartOnEnd = useCallback(() => {
    if (enabledRef.current && !cooldownRef.current) {
      startFnRef.current();
    }
  }, []);

  const start = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    // Stop any existing recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ignore */ }
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setIsActive(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (cooldownRef.current) return;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i]?.[0]?.transcript;
        if (transcript && isWakePhrase(transcript)) {
          cooldownRef.current = true;
          playSound("activate");
          recognition.abort();
          setIsListening(false);
          setIsActive(false);
          onWakeWordRef.current();

          setTimeout(restartAfterCooldown, 3000);
          return;
        }
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        setTimeout(restartOnError, 500);
      } else {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setTimeout(restartOnEnd, 300);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // Already started or not available
    }
  }, [stop, restartAfterCooldown, restartOnError, restartOnEnd]);

  // Keep the ref updated so callbacks can restart
  useEffect(() => {
    startFnRef.current = start;
  }, [start]);

  // Start/stop based on enabled state
  useEffect(() => {
    if (enabled) {
      start();
    } else {
      abortRecognition();
    }
    return () => {
      abortRecognition();
    };
  }, [enabled, start, abortRecognition]);

  return {
    isActive,
    isListening,
  };
}