// ============================================================
// SpeechRecognition Service — Web Speech API STT wrapper
// Singleton with lazy initialization, AnalyserNode for waveform
// ============================================================

type STTResultCallback = (text: string, isFinal: boolean) => void;
type STTErrorCallback = (error: string) => void;
type STTEndCallback = () => void;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export class SpeechRecognitionService {
  private static instance: SpeechRecognitionService | null = null;
  private recognition: SpeechRecognition | null = null;
  private analyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private rafId: number | null = null;
  private _listening = false;

  // Callbacks
  onResult: STTResultCallback | null = null;
  onError: STTErrorCallback | null = null;
  onEnd: STTEndCallback | null = null;

  private constructor() {}

  static getInstance(): SpeechRecognitionService {
    if (!SpeechRecognitionService.instance) {
      SpeechRecognitionService.instance = new SpeechRecognitionService();
    }
    return SpeechRecognitionService.instance;
  }

  static isSupported(): boolean {
    return getSpeechRecognition() !== null;
  }

  get listening(): boolean {
    return this._listening;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  /** Get current waveform data (Uint8Array of frequency bins) */
  getWaveformData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Get current volume level (0–1) from analyser */
  getVolume(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    return Math.min(1, sum / data.length / 90);
  }

  async startListening(language = "ru-RU"): Promise<void> {
    if (this._listening) return;

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      this.onError?.("Voice not supported in this browser");
      return;
    }

    // Set up audio analyser for visualization
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
    } catch {
      // Analyser setup is optional — STT can work without it
      this.analyser = null;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = language;
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        this.onResult?.(transcript, result.isFinal);
      }
    };

    this.recognition.onerror = (event) => {
      const errorMsg = event.error ?? "unknown";
      if (errorMsg === "no-speech") {
        // No speech detected, not a real error
        return;
      }
      if (errorMsg === "aborted") {
        return;
      }
      this.onError?.(errorMsg);
      this._listening = false;
    };

    this.recognition.onend = () => {
      // Auto-restart if still supposed to be listening (continuous mode)
      if (this._listening) {
        try {
          this.recognition?.start();
        } catch {
          this._listening = false;
          this.cleanupAudio();
          this.onEnd?.();
        }
      } else {
        this.cleanupAudio();
        this.onEnd?.();
      }
    };

    this._listening = true;
    this.recognition.start();
  }

  stopListening(): void {
    this._listening = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.cleanupAudio();
  }

  private cleanupAudio(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.analyser = null;
  }

  dispose(): void {
    this.stopListening();
    SpeechRecognitionService.instance = null;
  }
}