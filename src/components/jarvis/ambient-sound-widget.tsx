"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Headphones, Volume2, VolumeOff, Zap, CloudRain, Wind,
  CircleDot, Radiation, VolumeX
} from "lucide-react";
import { playSound } from "@/lib/sounds";

// ── Types ─────────────────────────────────────────────────────
type AmbientSound = "reactor" | "rain" | "space" | "electric" | "wind" | "silence";

interface AmbientOption {
  id: AmbientSound;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AMBIENT_OPTIONS: AmbientOption[] = [
  { id: "reactor", label: "Реактор", icon: Radiation },
  { id: "rain", label: "Дождь", icon: CloudRain },
  { id: "space", label: "Космос", icon: CircleDot },
  { id: "electric", label: "Электричество", icon: Zap },
  { id: "wind", label: "Ветер", icon: Wind },
  { id: "silence", label: "Тишина", icon: VolumeX },
];

const STORAGE_KEY = "jarvis-ambient-sound";

// ── Ambient sound engine ─────────────────────────────────────
interface ActiveNodes {
  oscillators: OscillatorNode[];
  sources: AudioBufferSourceNode[];
  gains: GainNode[];
  filters: BiquadFilterNode[];
  intervals: ReturnType<typeof setInterval>[];
  timeouts: ReturnType<typeof setTimeout>[];
  lfoOscillators: OscillatorNode[];
}

function createSilentNodes(): ActiveNodes {
  return {
    oscillators: [],
    sources: [],
    gains: [],
    filters: [],
    intervals: [],
    timeouts: [],
    lfoOscillators: [],
  };
}

function stopNodes(nodes: ActiveNodes) {
  const ctx = getAmbientCtx();
  try {
    nodes.oscillators.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    nodes.sources.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
    nodes.lfoOscillators.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
  } catch { /* ctx may be closed */ }
  nodes.intervals.forEach(clearInterval);
  nodes.timeouts.forEach(clearTimeout);
}

/** Get or create a shared AudioContext for ambient sounds */
let ambientCtx: AudioContext | null = null;

function getAmbientCtx(): AudioContext {
  if (!ambientCtx || ambientCtx.state === "closed") {
    ambientCtx = new AudioContext();
  }
  if (ambientCtx.state === "suspended") {
    ambientCtx.resume();
  }
  return ambientCtx;
}

/** Create a noise buffer (white noise) */
function createNoiseBuffer(ctx: AudioContext, duration = 2): AudioBuffer {
  const size = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Loop a buffer source seamlessly */
function createLoopingSource(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

// ── Sound generators ──────────────────────────────────────────

function startReactor(masterGain: GainNode): ActiveNodes {
  const ctx = getAmbientCtx();
  const nodes = createSilentNodes();

  // Main low-frequency oscillator (60Hz)
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(60, ctx.currentTime);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.35, ctx.currentTime);
  osc1.connect(g1).connect(masterGain);
  osc1.start();
  nodes.oscillators.push(osc1);
  nodes.gains.push(g1);

  // Subtle modulation oscillator (slow LFO on frequency)
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.3, ctx.currentTime);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(8, ctx.currentTime);
  lfo.connect(lfoGain).connect(osc1.frequency);
  lfo.start();
  nodes.lfoOscillators.push(lfo);
  nodes.gains.push(lfoGain);

  // Second harmonic (120Hz) at lower volume
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(120, ctx.currentTime);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.12, ctx.currentTime);
  osc2.connect(g2).connect(masterGain);
  osc2.start();
  nodes.oscillators.push(osc2);
  nodes.gains.push(g2);

  return nodes;
}

function startRain(masterGain: GainNode): ActiveNodes {
  const ctx = getAmbientCtx();
  const nodes = createSilentNodes();
  const noiseBuffer = createNoiseBuffer(ctx, 2);

  // Bandpass-filtered noise for rain
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(3000, ctx.currentTime);
  filter.Q.setValueAtTime(0.8, ctx.currentTime);
  nodes.filters.push(filter);

  const source = createLoopingSource(ctx, noiseBuffer);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, ctx.currentTime);
  source.connect(filter).connect(gain).connect(masterGain);
  source.start();
  nodes.sources.push(source);
  nodes.gains.push(gain);

  // Secondary noise layer — lower, more rumbly
  const filter2 = ctx.createBiquadFilter();
  filter2.type = "lowpass";
  filter2.frequency.setValueAtTime(800, ctx.currentTime);
  filter2.Q.setValueAtTime(0.5, ctx.currentTime);
  nodes.filters.push(filter2);

  const source2 = createLoopingSource(ctx, noiseBuffer);
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0.25, ctx.currentTime);
  source2.connect(filter2).connect(gain2).connect(masterGain);
  source2.start();
  nodes.sources.push(source2);
  nodes.gains.push(gain2);

  return nodes;
}

function startSpace(masterGain: GainNode): ActiveNodes {
  const ctx = getAmbientCtx();
  const nodes = createSilentNodes();

  // Very low drone at 40Hz
  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(40, ctx.currentTime);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.5, ctx.currentTime);
  osc1.connect(g1).connect(masterGain);
  osc1.start();
  nodes.oscillators.push(osc1);
  nodes.gains.push(g1);

  // Slow LFO modulating volume for "breathing" space feel
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.08, ctx.currentTime); // Very slow
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0.2, ctx.currentTime);
  lfo.connect(lfoGain).connect(g1.gain);
  lfo.start();
  nodes.lfoOscillators.push(lfo);
  nodes.gains.push(lfoGain);

  // Sub-harmonic at 20Hz
  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(20, ctx.currentTime);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.3, ctx.currentTime);
  osc2.connect(g2).connect(masterGain);
  osc2.start();
  nodes.oscillators.push(osc2);
  nodes.gains.push(g2);

  return nodes;
}

function startElectric(masterGain: GainNode): ActiveNodes {
  const ctx = getAmbientCtx();
  const nodes = createSilentNodes();
  const noiseBuffer = createNoiseBuffer(ctx, 2);

  // High-pass filtered noise for crackling base
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(4000, ctx.currentTime);
  filter.Q.setValueAtTime(1.5, ctx.currentTime);
  nodes.filters.push(filter);

  const source = createLoopingSource(ctx, noiseBuffer);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  source.connect(filter).connect(gain).connect(masterGain);
  source.start();
  nodes.sources.push(source);
  nodes.gains.push(gain);

  // Random crackles via oscillators that pop on and off
  const crackleGain = ctx.createGain();
  crackleGain.gain.setValueAtTime(0, ctx.currentTime);
  crackleGain.connect(masterGain);
  nodes.gains.push(crackleGain);

  const doCrackle = () => {
    if (crackleGain.gain.value === 0) return; // stopped
    const now = ctx.currentTime;
    const crackleOsc = ctx.createOscillator();
    crackleOsc.type = "sawtooth";
    crackleOsc.frequency.setValueAtTime(2000 + Math.random() * 6000, now);
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(0.15 * (0.5 + Math.random() * 0.5), now);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03 + Math.random() * 0.05);
    crackleOsc.connect(cGain).connect(crackleGain);
    crackleOsc.start(now);
    crackleOsc.stop(now + 0.08);
  };

  // Periodic crackles
  const interval = setInterval(() => {
    const count = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const delay = Math.random() * 200;
      const t = setTimeout(doCrackle, delay);
      nodes.timeouts.push(t);
    }
  }, 300 + Math.random() * 700);
  nodes.intervals.push(interval);

  return nodes;
}

function startWind(masterGain: GainNode): ActiveNodes {
  const ctx = getAmbientCtx();
  const nodes = createSilentNodes();
  const noiseBuffer = createNoiseBuffer(ctx, 2);

  // Bandpass filter for wind character
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(600, ctx.currentTime);
  filter.Q.setValueAtTime(0.3, ctx.currentTime);
  nodes.filters.push(filter);

  const source = createLoopingSource(ctx, noiseBuffer);
  const windGain = ctx.createGain();
  windGain.gain.setValueAtTime(0.35, ctx.currentTime);
  source.connect(filter).connect(windGain).connect(masterGain);
  source.start();
  nodes.sources.push(source);
  nodes.gains.push(windGain);

  // Slow LFO modulating the filter frequency for gusting effect
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.15, ctx.currentTime);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(400, ctx.currentTime);
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  nodes.lfoOscillators.push(lfo);
  nodes.gains.push(lfoGain);

  // Secondary volume modulation for breathing wind
  const lfo2 = ctx.createOscillator();
  lfo2.type = "sine";
  lfo2.frequency.setValueAtTime(0.07, ctx.currentTime);
  const lfo2Gain = ctx.createGain();
  lfo2Gain.gain.setValueAtTime(0.15, ctx.currentTime);
  lfo2.connect(lfo2Gain).connect(windGain.gain);
  lfo2.start();
  nodes.lfoOscillators.push(lfo2);
  nodes.gains.push(lfo2Gain);

  return nodes;
}

const SOUND_GENERATORS: Record<
  Exclude<AmbientSound, "silence">,
  (masterGain: GainNode) => ActiveNodes
> = {
  reactor: startReactor,
  rain: startRain,
  space: startSpace,
  electric: startElectric,
  wind: startWind,
};

// ── Component ─────────────────────────────────────────────────
export function AmbientSoundWidget() {
  const [activeSound, setActiveSound] = useState<AmbientSound>("silence");
  const [volume, setVolume] = useState(50);

  // Refs for audio nodes
  const activeNodesRef = useRef<ActiveNodes>(createSilentNodes());
  const masterGainRef = useRef<GainNode | null>(null);

  // Load persisted state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { sound: AmbientSound; volume: number };
        if (parsed.sound && AMBIENT_OPTIONS.some((o) => o.id === parsed.sound)) {
          setActiveSound(parsed.sound);
        }
        if (typeof parsed.volume === "number" && parsed.volume >= 0 && parsed.volume <= 100) {
          setVolume(parsed.volume);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sound: activeSound, volume }));
    } catch {
      /* ignore */
    }
  }, [activeSound, volume]);

  // Update master gain when volume changes
  useEffect(() => {
    if (masterGainRef.current) {
      const ctx = getAmbientCtx();
      masterGainRef.current.gain.setTargetAtTime(
        volume / 100 * 0.5, // max 0.5 to keep it ambient
        ctx.currentTime,
        0.1,
      );
    }
  }, [volume]);

  // Stop all ambient sounds
  const stopAll = useCallback(() => {
    if (masterGainRef.current) {
      const ctx = getAmbientCtx();
      try {
        masterGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      } catch { /* ignore */ }
      // Actually disconnect after fade
      setTimeout(() => {
        stopNodes(activeNodesRef.current);
        activeNodesRef.current = createSilentNodes();
        if (masterGainRef.current) {
          try { masterGainRef.current.disconnect(); } catch { /* ignore */ }
          masterGainRef.current = null;
        }
      }, 100);
    }
  }, []);

  // Start a specific ambient sound
  const startSound = useCallback((soundId: Exclude<AmbientSound, "silence">) => {
    // Stop previous
    stopNodes(activeNodesRef.current);
    activeNodesRef.current = createSilentNodes();
    if (masterGainRef.current) {
      try { masterGainRef.current.disconnect(); } catch { /* ignore */ }
    }

    const ctx = getAmbientCtx();
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume / 100 * 0.5, ctx.currentTime);
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const generator = SOUND_GENERATORS[soundId];
    if (generator) {
      activeNodesRef.current = generator(masterGain);
    }
  }, [volume, stopAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopNodes(activeNodesRef.current);
      if (masterGainRef.current) {
        try { masterGainRef.current.disconnect(); } catch { /* ignore */ }
        masterGainRef.current = null;
      }
    };
  }, []);

  // Handle sound selection
  const handleSelect = useCallback((id: AmbientSound) => {
    playSound("click", 0.2);

    if (id === "silence") {
      stopAll();
      setActiveSound("silence");
    } else {
      setActiveSound(id);
      // Delay start slightly so state updates first
      setTimeout(() => {
        startSound(id);
      }, 10);
    }
  }, [stopAll, startSound]);

  // Auto-start if persisted sound is not silence
  useEffect(() => {
    if (activeSound !== "silence") {
      // Small delay to allow AudioContext to be ready
      const t = setTimeout(() => {
        startSound(activeSound as Exclude<AmbientSound, "silence">);
      }, 200);
      return () => clearTimeout(t);
    }
  }, []); // Only on mount

  const VolumeIcon = activeSound === "silence" ? VolumeOff : Volume2;

  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-3 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Headphones className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Ambient
            </span>
          </div>
          {activeSound !== "silence" && (
            <span className="flex items-center gap-1 font-mono text-[10px] text-primary/60">
              <span className="h-1.5 w-1.5 rounded-full bg-primary anim-pulse-glow" />
              LIVE
            </span>
          )}
        </div>

        {/* Sound grid 3x2 */}
        <div className="grid grid-cols-3 gap-1.5">
          {AMBIENT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = activeSound === option.id;

            return (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 transition font-mono ${
                  isActive
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-muted-foreground/20 bg-primary/5 text-muted-foreground hover:border-primary/30"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "anim-pulse-glow" : ""}`} />
                <span className="text-[10px] leading-tight">{option.label}</span>
              </button>
            );
          })}
        </div>

        {/* Volume slider */}
        <div className="flex items-center gap-2 border-t jarvis-border-cyan pt-2">
          <VolumeIcon className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
          />
          <span className="w-7 flex-shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
            {volume}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}