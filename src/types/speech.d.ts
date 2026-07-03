// Web Speech API type declarations (not in standard TS lib)

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(_index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(_index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  grammars: unknown;
  onaudioend: ((this: SpeechRecognition, _ev: Event) => void) | null;
  onaudiostart: ((this: SpeechRecognition, _ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, _ev: Event) => void) | null;
  onerror: ((this: SpeechRecognition, _ev: SpeechRecognitionErrorEvent) => void) | null;
  onnomatch: ((this: SpeechRecognition, _ev: SpeechRecognitionEvent) => void) | null;
  onresult: ((this: SpeechRecognition, _ev: SpeechRecognitionEvent) => void) | null;
  onsoundend: ((this: SpeechRecognition, _ev: Event) => void) | null;
  onsoundstart: ((this: SpeechRecognition, _ev: Event) => void) | null;
  onspeechend: ((this: SpeechRecognition, _ev: Event) => void) | null;
  onspeechstart: ((this: SpeechRecognition, _ev: Event) => void) | null;
  onstart: ((this: SpeechRecognition, _ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}

interface Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}