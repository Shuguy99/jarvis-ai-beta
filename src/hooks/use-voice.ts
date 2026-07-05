// ============================================================
// useVoice — React hook for VoicePipeline integration
// Provides waveform data, transcript, and lifecycle management
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { VoicePipeline, type VoicePipelineState } from "@/lib/voice-pipeline";
import { SpeechRecognitionService } from "@/lib/voice-stt";

export interface UseVoiceOptions {
  /** Called when STT produces a final transcript — send to AI */
  onTranscriptFinal?: (text: string) => void;
  /** Called when pipeline state changes */
  onStateChange?: (state: VoicePipelineState) => void;
}

export interface UseVoiceReturn {
  /** Current pipeline state */
  state: VoicePipelineState;
  /** Whether STT is actively listening */
  isListening: boolean;
  /** Whether TTS is currently speaking */
  isSpeaking: boolean;
  /** Whether AI is processing */
  isProcessing: boolean;
  /** Current interim transcript */
  transcript: string;
  /** Start the voice pipeline (begin listening) */
  startVoice: () => void;
  /** Stop the voice pipeline completely */
  stopVoice: () => void;
  /** Current audio volume level (0–1) from analyser */
  volume: number;
  /** Waveform data (Uint8Array) for visualization */
  waveformData: Uint8Array;
  /** Whether voice (STT) is supported in this browser */
  isSupported: boolean;
  /** Speak an AI response through TTS */
  speakResponse: (text: string) => void;
}

export function useVoice(opts: UseVoiceOptions = {}): UseVoiceReturn {
  const pipelineRef = useRef<VoicePipeline | null>(null);
  const rafRef = useRef<number | null>(null);
  const [state, setState] = useState<VoicePipelineState>("idle");
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(0);
  const [waveformData, setWaveformData] = useState<Uint8Array>(new Uint8Array(0));

  const isSupported = SpeechRecognitionService.isSupported();

  // Lazy-init pipeline
  const getPipeline = useCallback(() => {
    if (!pipelineRef.current) {
      pipelineRef.current = new VoicePipeline();
    }
    return pipelineRef.current;
  }, []);

  // Tick function for volume + waveform updates
  const tick = useCallback(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline || pipeline.state !== "listening") return;

    setVolume(pipeline.getVolume());
    setWaveformData(pipeline.getWaveformData());
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Start voice
  const startVoice = useCallback(() => {
    const pipeline = getPipeline();

    pipeline.onStateChange = (newState) => {
      setState(newState);
      opts.onStateChange?.(newState);

      if (newState === "listening") {
        // Start animation loop
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Stop animation loop
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        setVolume(0);
        setWaveformData(new Uint8Array(0));
      }
    };

    pipeline.onTranscript = (text, isFinal) => {
      setTranscript(text);
      if (isFinal && text) {
        opts.onTranscriptFinal?.(text);
      }
    };

    pipeline.onAISend = (text) => {
      opts.onTranscriptFinal?.(text);
    };

    pipeline.activate();
  }, [getPipeline, opts, tick]);

  // Stop voice
  const stopVoice = useCallback(() => {
    const pipeline = pipelineRef.current;
    if (pipeline) {
      pipeline.deactivate();
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setVolume(0);
    setWaveformData(new Uint8Array(0));
    setTranscript("");
    setState("idle");
  }, []);

  // Speak response (called after AI completes)
  const speakResponse = useCallback((text: string) => {
    const pipeline = getPipeline();
    pipeline.speakResponse(text);
  }, [getPipeline]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (pipelineRef.current) {
        pipelineRef.current.dispose();
        pipelineRef.current = null;
      }
    };
  }, []);

  return {
    state,
    isListening: state === "listening",
    isSpeaking: state === "speaking",
    isProcessing: state === "processing",
    transcript,
    startVoice,
    stopVoice,
    volume,
    waveformData,
    isSupported,
    speakResponse,
  };
}