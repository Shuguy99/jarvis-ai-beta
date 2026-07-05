// ============================================================
// SpeechSynthesis Service — Web Speech API TTS wrapper
// Queue system, voice selection, word-level boundary events
// ============================================================

export interface TTSSpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: SpeechSynthesisVoice;
}

type TTSStartCallback = () => void;
type TTSEndCallback = () => void;
type TTSErrorCallback = (error: string) => void;
type TTSBoundaryCallback = (charIndex: number, charLength: number) => void;

export class SpeechSynthesisService {
  private static instance: SpeechSynthesisService | null = null;
  private queue: Array<{
    text: string;
    options: TTSSpeakOptions;
  }> = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private _speaking = false;
  private _paused = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;

  // Callbacks
  onStart: TTSStartCallback | null = null;
  onEnd: TTSEndCallback | null = null;
  onError: TTSErrorCallback | null = null;
  onBoundary: TTSBoundaryCallback | null = null;

  private constructor() {
    this.loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        this.loadVoices();
      });
    }
  }

  static getInstance(): SpeechSynthesisService {
    if (!SpeechSynthesisService.instance) {
      SpeechSynthesisService.instance = new SpeechSynthesisService();
    }
    return SpeechSynthesisService.instance;
  }

  private loadVoices(): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    this.voices = Array.from(window.speechSynthesis.getVoices());
    this.voicesLoaded = true;

    // Auto-select best voice if none selected
    if (!this.selectedVoice && this.voices.length > 0) {
      this.selectedVoice = this.pickBestVoice("ru");
    }
  }

  get isSpeaking(): boolean {
    return this._speaking;
  }

  get isPaused(): boolean {
    return this._paused;
  }

  /** Get all available voices */
  getVoices(): SpeechSynthesisVoice[] {
    if (!this.voicesLoaded) this.loadVoices();
    return this.voices;
  }

  /** Set the voice for future speak calls */
  setVoice(voice: SpeechSynthesisVoice): void {
    this.selectedVoice = voice;
  }

  /** Get the currently selected voice */
  getSelectedVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice;
  }

  /** Auto-select best voice for a given language */
  pickBestVoice(lang = "ru"): SpeechSynthesisVoice | null {
    const voices = this.getVoices();
    if (voices.length === 0) return null;

    if (lang.startsWith("ru")) {
      const preferred = [
        "Microsoft Irina",
        "Pavel",
        "Google русский",
        "Yandex",
        "Milena",
        "Tatyana",
        "Alice",
      ];
      for (const name of preferred) {
        const found = voices.find((v) => v.name.includes(name) && v.lang.startsWith("ru"));
        if (found) return found;
      }
      const exact = voices.find((v) => v.lang === "ru-RU");
      if (exact) return exact;
      const ruVoice = voices.find((v) => v.lang.startsWith("ru"));
      if (ruVoice) return ruVoice;
    }

    if (lang.startsWith("en")) {
      const enVoice = voices.find((v) => v.lang.startsWith("en"));
      if (enVoice) return enVoice;
    }

    return voices[0] ?? null;
  }

  /** Speak text (queues if already speaking) */
  speak(text: string, options: TTSSpeakOptions = {}): void {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      this.onError?.("Speech synthesis not supported");
      return;
    }

    if (!text.trim()) return;

    this.queue.push({ text, options });
    this.processQueue();
  }

  /** Stop all speech and clear queue */
  stop(): void {
    this.queue.length = 0;
    this._speaking = false;
    this._paused = false;
    this.currentUtterance = null;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  /** Pause current speech */
  pause(): void {
    if (this._speaking && !this._paused) {
      this._paused = true;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.pause();
      }
    }
  }

  /** Resume paused speech */
  resume(): void {
    if (this._paused) {
      this._paused = false;
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
    }
  }

  private processQueue(): void {
    if (this._speaking || this.queue.length === 0) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const item = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(item.text);

    utterance.rate = item.options.rate ?? 1.0;
    utterance.pitch = item.options.pitch ?? 1.0;
    utterance.volume = item.options.volume ?? 1.0;

    const voice = item.options.voice ?? this.selectedVoice ?? this.pickBestVoice("ru");
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "ru-RU";
    }

    utterance.onstart = () => {
      this._speaking = true;
      this._paused = false;
      this.onStart?.();
    };

    utterance.onend = () => {
      this._speaking = false;
      this._paused = false;
      this.currentUtterance = null;
      this.onEnd?.();

      // Chrome workaround: long text can pause unexpectedly
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.resume();
      }

      // Process next in queue
      this.processQueue();
    };

    utterance.onerror = (e) => {
      if (e.error === "canceled" || e.error === "interrupted") return;
      this._speaking = false;
      this._paused = false;
      this.currentUtterance = null;
      this.onError?.(e.error);
      this.processQueue();
    };

    utterance.onboundary = (e) => {
      this.onBoundary?.(e.charIndex, e.charLength);
    };

    // Chrome workaround: resume if synth pauses mid-speech
    utterance.onpause = () => {
      if (this._speaking && !this._paused) {
        setTimeout(() => {
          if (
            typeof window !== "undefined" &&
            window.speechSynthesis &&
            window.speechSynthesis.speaking &&
            !window.speechSynthesis.pending &&
            this._speaking
          ) {
            window.speechSynthesis.resume();
          }
        }, 100);
      }
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  /** Get the current char index being spoken (from boundary events) */
  dispose(): void {
    this.stop();
    SpeechSynthesisService.instance = null;
  }
}