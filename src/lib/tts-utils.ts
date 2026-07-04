

// Shared TTS utilities for JARVIS — used by chat, proactive engine, voice commands

// Voice cache to avoid repeated voice loading
let cachedVoices: SpeechSynthesisVoice[] | null = null;
let voicesLoaded = false;

/** Get all available voices, with async loading for Chrome */
export function getVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  if (cachedVoices && voicesLoaded) return cachedVoices;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
    voicesLoaded = true;
    return voices;
  }

  // Chrome loads voices async — set up listener
  window.speechSynthesis.addEventListener(
    "voiceschanged",
    () => {
      cachedVoices = window.speechSynthesis.getVoices();
      voicesLoaded = true;
    },
    { once: true }
  );

  return voices;
}

/** Pick the best Russian voice from available voices */
export function pickRussianVoice(
  voices?: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  const list = voices ?? getVoices();
  if (list.length === 0) return undefined;

  // Priority order for Russian voices
  const preferred = [
    "Microsoft Irina",
    "Pavel",
    "Google русский",
    "Yandex",
    "Milena",
    "Tatyana",
    "Alice",
  ];

  // Try preferred names first
  for (const name of preferred) {
    const found = list.find(
      (v) => v.name.includes(name) && v.lang.startsWith("ru")
    );
    if (found) return found;
  }

  // Fallback: any Russian voice
  const ruVoice = list.find((v) => v.lang.startsWith("ru"));
  if (ruVoice) return ruVoice;

  // Last resort: first available voice
  return list[0];
}

/** Speak text with proper Russian voice and options */
export function speakWithJarvisVoice(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    volume?: number;
    onEnd?: () => void;
    onError?: () => void;
  }
): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = options?.rate ?? 1.0;
  utterance.pitch = options?.pitch ?? 0.9;
  utterance.volume = options?.volume ?? 0.8;

  const voice = pickRussianVoice();
  if (voice) utterance.voice = voice;

  if (options?.onEnd) utterance.onend = options.onEnd;
  if (options?.onError) utterance.onerror = options.onError;

  window.speechSynthesis.speak(utterance);
  return utterance;
}