// ============================================================
// Voice Pipeline — Orchestrates STT → AI → TTS flow
// Walkie-talkie mode, state machine, volume visualization
// ============================================================

import { SpeechRecognitionService } from "./voice-stt";
import { SpeechSynthesisService, type TTSSpeakOptions } from "./voice-tts";
import { useUIStore } from "./ui-store";

export type VoicePipelineState = "idle" | "listening" | "processing" | "speaking";

type StateChangeCallback = (state: VoicePipelineState) => void;
type TranscriptCallback = (text: string, isFinal: boolean) => void;
type AISendCallback = (text: string) => void;

export class VoicePipeline {
  private stt: SpeechRecognitionService;
  private tts: SpeechSynthesisService;
  private _state: VoicePipelineState = "idle";
  private finalTranscript = "";
  private interimTranscript = "";
  private disposed = false;

  // Callbacks
  onStateChange: StateChangeCallback | null = null;
  onTranscript: TranscriptCallback | null = null;
  onAISend: AISendCallback | null = null;

  constructor() {
    this.stt = SpeechRecognitionService.getInstance();
    this.tts = SpeechSynthesisService.getInstance();

    // Wire STT events
    this.stt.onResult = (text, isFinal) => {
      if (isFinal) {
        this.finalTranscript += text + " ";
        this.onTranscript?.(this.finalTranscript.trim(), true);
        // Send to AI
        const transcript = this.finalTranscript.trim();
        if (transcript) {
          this.setState("processing");
          this.onAISend?.(transcript);
          this.finalTranscript = "";
          this.interimTranscript = "";
        }
      } else {
        this.interimTranscript = text;
        this.onTranscript?.(
          (this.finalTranscript + this.interimTranscript).trim(),
          false
        );
      }
    };

    this.stt.onError = (error) => {
      if (error === "no-speech" || error === "aborted") return;
      console.error("[VoicePipeline] STT error:", error);
      if (this._state === "listening") {
        // If not in walkie-talkie mode, go back to idle
        const autoReactivate = useUIStore.getState().voiceAutoReactivate;
        if (!autoReactivate) {
          this.setState("idle");
        }
      }
    };

    this.stt.onEnd = () => {
      if (this.disposed) return;
      // If we're still supposed to be listening (walkie-talkie), STT auto-restarts
      if (this._state === "listening") {
        const autoReactivate = useUIStore.getState().voiceAutoReactivate;
        if (!autoReactivate) {
          this.setState("idle");
        }
      }
    };

    // Wire TTS events
    this.tts.onStart = () => {
      this.setState("speaking");
    };

    this.tts.onEnd = () => {
      if (this.disposed) return;
      const autoReactivate = useUIStore.getState().voiceAutoReactivate;
      if (autoReactivate) {
        // Walkie-talkie: go back to listening after speaking
        this.setState("listening");
        this.finalTranscript = "";
        this.interimTranscript = "";
        this.stt.startListening(this.getLanguage()).catch(() => {
          this.setState("idle");
        });
      } else {
        this.setState("idle");
      }
    };

    this.tts.onError = () => {
      this.setState("idle");
    };
  }

  get state(): VoicePipelineState {
    return this._state;
  }

  get isListening(): boolean {
    return this._state === "listening";
  }

  get isSpeaking(): boolean {
    return this._state === "speaking";
  }

  get isProcessing(): boolean {
    return this._state === "processing";
  }

  /** Get the STT analyser for waveform data */
  getAnalyser(): AnalyserNode | null {
    return this.stt.getAnalyser();
  }

  /** Get current waveform data from STT analyser */
  getWaveformData(): Uint8Array {
    return this.stt.getWaveformData();
  }

  /** Get current volume (0–1) from STT analyser */
  getVolume(): number {
    return this.stt.getVolume();
  }

  /** Get the TTS service for direct access */
  getTTS(): SpeechSynthesisService {
    return this.tts;
  }

  /** Get the STT service for direct access */
  getSTT(): SpeechRecognitionService {
    return this.stt;
  }

  /** Activate the pipeline — starts listening */
  activate(): void {
    if (this.disposed) return;

    // Stop any current TTS
    if (this.tts.isSpeaking) {
      this.tts.stop();
    }

    this.setState("listening");
    this.finalTranscript = "";
    this.interimTranscript = "";

    this.stt.startListening(this.getLanguage()).catch((err) => {
      console.error("[VoicePipeline] Failed to start listening:", err);
      this.setState("idle");
    });
  }

  /** Deactivate the pipeline — stops everything */
  deactivate(): void {
    this.stt.stopListening();
    this.tts.stop();
    this.setState("idle");
    this.finalTranscript = "";
    this.interimTranscript = "";
  }

  /** Called when AI response is complete — sends to TTS */
  speakResponse(text: string, options?: TTSSpeakOptions): void {
    if (this.disposed || !text.trim()) {
      this.setState("idle");
      return;
    }

    // Stop listening while speaking
    if (this._state === "listening") {
      this.stt.stopListening();
    }

    const voiceEnabled = useUIStore.getState().voiceEnabled;
    if (!voiceEnabled) {
      this.setState("idle");
      return;
    }

    this.setState("speaking");

    const voiceIndex = useUIStore.getState().selectedVoiceIndex;
    const voices = this.tts.getVoices();
    const voice = voiceIndex >= 0 && voiceIndex < voices.length
      ? voices[voiceIndex]
      : undefined;

    this.tts.speak(text, { voice, ...options });
  }

  /** Force pipeline back to idle (e.g. when AI errors) */
  reset(): void {
    this.stt.stopListening();
    this.tts.stop();
    this.finalTranscript = "";
    this.interimTranscript = "";
    this.setState("idle");
  }

  /** Clean up resources */
  dispose(): void {
    this.disposed = true;
    this.stt.stopListening();
    this.tts.stop();
    this.onStateChange = null;
    this.onTranscript = null;
    this.onAISend = null;
  }

  private setState(state: VoicePipelineState): void {
    if (this._state === state) return;
    this._state = state;
    this.onStateChange?.(state);
  }

  private getLanguage(): string {
    const settings = useUIStore.getState().jarvisSettings;
    return settings?.language === "en" ? "en-US" : "ru-RU";
  }
}