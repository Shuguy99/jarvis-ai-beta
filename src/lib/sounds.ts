/**
 * JARVIS Sound System — синтезированные UI-звуки через Web Audio API.
 * Никаких внешних аудиофайлов — всё генерируется программно.
 */

type SoundName =
  | "click"
  | "hover"
  | "activate"
  | "deactivate"
  | "mic-on"
  | "mic-off"
  | "notification"
  | "boot-chime"
  | "error"
  | "success"
  | "message-send"
  | "message-receive"
  | "scan"
  | "glitch"
  | "typewriter-tick"
  | "shutdown"
  | "save"
  | "warning";

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

/** Гладкий трапецеидальный огибающий */
function envelope(
  ctx: AudioContext,
  param: AudioParam,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  duration: number
) {
  const now = ctx.currentTime;
  param.setValueAtTime(0, now);
  param.linearRampToValueAtTime(sustain, now + attack);
  param.linearRampToValueAtTime(sustain * decay, now + attack + decay);
  param.setValueAtTime(sustain * decay, now + duration - release);
  param.linearRampToValueAtTime(0, now + duration);
}

function playTone(
  freq: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.08
) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  envelope(ctx, gain.gain, 0.005, 0.3, volume, duration * 0.4, duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

function playDualTone(
  f1: number,
  f2: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.06
) {
  const ctx = getCtx();
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = type;
  osc2.type = type;
  osc1.frequency.setValueAtTime(f1, ctx.currentTime);
  osc2.frequency.setValueAtTime(f2, ctx.currentTime);
  envelope(ctx, gain.gain, 0.005, 0.2, volume, duration * 0.5, duration);
  osc1.connect(gain).connect(ctx.destination);
  osc2.connect(gain).connect(ctx.destination);
  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + duration);
  osc2.stop(ctx.currentTime + duration);
}

function playSweep(
  from: number,
  to: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.06
) {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + duration);
  envelope(ctx, gain.gain, 0.01, 0.2, volume, duration * 0.6, duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.01);
}

function playNoiseBurst(duration: number, volume = 0.03) {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  envelope(ctx, gain.gain, 0.001, 0.1, volume, duration * 0.3, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.Q.setValueAtTime(5, ctx.currentTime);
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
}

const SOUND_MAP: Record<SoundName, (vol?: number) => void> = {
  /** Короткий клик по кнопке — резкий, высокий */
  click(vol) {
    playTone(1800, 0.04, "square", 0.04 * (vol ?? 1));
  },

  /** Лёгкий ховер — почти неслышный блик */
  hover(vol) {
    playTone(2400, 0.02, "sine", 0.015 * (vol ?? 1));
  },

  /** Активация системы — восходящий аккорд */
  activate(vol) {
    const v = vol ?? 1;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const freqs = [440, 554, 659, 880];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      envelope(ctx, gain.gain, 0.01, 0.3, 0.06 * v, 0.4, 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + 1.0);
    });
  },

  /** Деактивация — нисходящий тон */
  deactivate(vol) {
    playSweep(880, 220, 0.5, "sine", 0.06 * (vol ?? 1));
  },

  /** Микрофон включён — двойной бип восходящий */
  "mic-on"(vol) {
    playDualTone(600, 900, 0.12, "sine", 0.07 * (vol ?? 1));
    setTimeout(() => playDualTone(900, 1200, 0.12, "sine", 0.07 * (vol ?? 1)), 130);
  },

  /** Микрофон выключен — двойной бип нисходящий */
  "mic-off"(vol) {
    playDualTone(1200, 900, 0.12, "sine", 0.07 * (vol ?? 1));
    setTimeout(() => playDualTone(900, 600, 0.12, "sine", 0.07 * (vol ?? 1)), 130);
  },

  /** Уведомление — мелодичный Ding */
  notification(vol) {
    const v = vol ?? 1;
    const ctx = getCtx();
    const now = ctx.currentTime;
    // Main ding
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1200, now);
    envelope(ctx, gain1.gain, 0.005, 0.1, 0.1 * v, 0.6, 0.8);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 1.0);
    // Harmonic
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1800, now);
    envelope(ctx, gain2.gain, 0.005, 0.1, 0.04 * v, 0.4, 0.6);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.8);
  },

  /** Загрузочная мелодия JARVIS — 3 ноты восходящие */
  "boot-chime"(vol) {
    const v = vol ?? 1;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        envelope(ctx, gain.gain, 0.02, 0.2, 0.08 * v, 0.5, 0.6);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      }, i * 180);
    });
  },

  /** Ошибка — низкий резкий бузз */
  error(vol) {
    playTone(180, 0.25, "sawtooth", 0.05 * (vol ?? 1));
    playNoiseBurst(0.15, 0.04 * (vol ?? 1));
  },

  /** Успех — мажорный аккорд */
  success(vol) {
    const v = vol ?? 1;
    const ctx = getCtx();
    const now = ctx.currentTime;
    [523, 659, 784].forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      envelope(ctx, gain.gain, 0.01, 0.2, 0.06 * v, 0.3, 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.7);
    });
  },

  /** Отправка сообщения — короткий «пшик» */
  "message-send"(vol) {
    playSweep(1400, 2000, 0.06, "sine", 0.04 * (vol ?? 1));
  },

  /** Получение сообщения — мягкий «динь» */
  "message-receive"(vol) {
    const v = vol ?? 1;
    playTone(880, 0.08, "sine", 0.04 * v);
    setTimeout(() => playTone(1100, 0.1, "sine", 0.03 * v), 90);
  },

  /** Сканирование — быстрый частотный свип 300→2000→300 Гц */
  scan(vol) {
    const v = vol ?? 1;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const half = 0.2; // 0.4s total, half for each direction

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(2000, now + half);
    osc.frequency.exponentialRampToValueAtTime(300, now + half * 2);
    envelope(ctx, gain.gain, 0.005, 0.3, 0.04 * v, 0.1, 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.41);
  },

  /** Цифровой глитч — 3 коротких шумовых всплеска со случайными частотами */
  glitch(vol) {
    const v = vol ?? 1;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const ctx = getCtx();
        const now = ctx.currentTime;
        const freq = 100 + Math.random() * 2900; // 100–3000 Hz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, now);
        envelope(ctx, gain.gain, 0.001, 0.1, 0.03 * v, 0.005, 0.03);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.035);
      }, i * 50);
    }
  },

  /** Стук клавиши печатной машинки — едва слышный блик 800 Гц */
  "typewriter-tick"(vol) {
    const v = vol ?? 1;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    envelope(ctx, gain.gain, 0.001, 0.1, 0.02 * v, 0.003, 0.015);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.02);
  },

  /** Завершение работы — нисходящая последовательность C5→G4→E4→C4 */
  shutdown(vol) {
    const v = vol ?? 1;
    const notes = [523, 392, 330, 262]; // C5, G4, E4, C4
    notes.forEach((f, i) => {
      setTimeout(() => {
        const ctx = getCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now);
        envelope(ctx, gain.gain, 0.01, 0.2, 0.05 * v, 0.15, 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.31);
      }, i * 200);
    });
  },

  /** Сохранение — быстрые два восходящих тона */
  save(vol) {
    const v = vol ?? 1;
    playTone(660, 0.1, "sine", 0.05 * v);
    setTimeout(() => playTone(880, 0.1, "sine", 0.05 * v), 100);
  },

  /** Предупреждение — пульсирующий тон 600 Гц, 3 импульса */
  warning(vol) {
    const v = vol ?? 1;
    const ctx = getCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.16; // 0.08s on + 0.08s off per pulse
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(600, start);
      envelope(ctx, gain.gain, 0.002, 0.1, 0.04 * v, 0.02, 0.08);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.085);
    }
  },
};

/** Воспроизвести звук по имени */
export function playSound(name: SoundName, vol?: number) {
  try {
    SOUND_MAP[name]?.(vol);
  } catch {
    /* silent fail — аудио может быть недоступно */
  }
}

/** Прединициализировать AudioContext (нужен user gesture) */
export function initAudio() {
  try {
    getCtx();
  } catch {
    /* ignore */
  }
}

export type { SoundName };