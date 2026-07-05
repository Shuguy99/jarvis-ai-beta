// ============================================================
// Voice Settings — Voice selection, language, rate/pitch/volume,
// walkie-talkie mode, test voice button
// ============================================================

import { useCallback, useEffect, useState } from "react";
import { Mic, MicOff, Volume2, Settings, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/lib/ui-store";
import { SpeechSynthesisService } from "@/lib/voice-tts";
import { playSound } from "@/lib/sounds";

const STT_LANGUAGES = [
  { code: "ru-RU", label: "Русский" },
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "de-DE", label: "Deutsch" },
  { code: "fr-FR", label: "Français" },
  { code: "es-ES", label: "Español" },
  { code: "ja-JP", label: "日本語" },
  { code: "zh-CN", label: "中文" },
];

export function VoiceSettings() {
  const voiceEnabled = useUIStore((s) => s.voiceEnabled);
  const setVoiceEnabled = useUIStore((s) => s.setVoiceEnabled);
  const voiceAutoReactivate = useUIStore((s) => s.voiceAutoReactivate);
  const setVoiceAutoReactivate = useUIStore((s) => s.setVoiceAutoReactivate);
  const selectedVoiceIndex = useUIStore((s) => s.selectedVoiceIndex);
  const setSelectedVoiceIndex = useUIStore((s) => s.setSelectedVoiceIndex);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [sttLanguage, setSttLanguage] = useState("ru-RU");
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [ttsVolume, setTtsVolume] = useState(1.0);
  const [testing, setTesting] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Load TTS voices
  useEffect(() => {
    const tts = SpeechSynthesisService.getInstance();
    const loadVoices = () => {
      setVoices(tts.getVoices());
      // Set current selected voice
      const current = tts.getSelectedVoice();
      if (current) {
        const idx = tts.getVoices().findIndex((v) => v.name === current.name);
        if (idx >= 0) setSelectedVoiceIndex(idx);
      }
    };

    loadVoices();

    // Listen for voiceschanged
    const synth = window.speechSynthesis;
    if (synth) {
      synth.addEventListener("voiceschanged", loadVoices);
      return () => synth.removeEventListener("voiceschanged", loadVoices);
    }
  }, [setSelectedVoiceIndex]);

  // Check STT support
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
    setIsSupported(supported);
  }, []);

  // Load saved language from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("jarvis-voice-stt-lang");
      if (saved) setSttLanguage(saved);
    } catch {
      // ignore
    }
  }, []);

  const handleVoiceChange = useCallback(
    (idx: number) => {
      setSelectedVoiceIndex(idx);
      const tts = SpeechSynthesisService.getInstance();
      const allVoices = tts.getVoices();
      if (idx >= 0 && idx < allVoices.length) {
        tts.setVoice(allVoices[idx]);
      }
    },
    [setSelectedVoiceIndex]
  );

  const handleLanguageChange = useCallback(
    (code: string) => {
      setSttLanguage(code);
      try {
        localStorage.setItem("jarvis-voice-stt-lang", code);
      } catch {
        // ignore
      }
    },
    []
  );

  const handleTestVoice = useCallback(() => {
    const tts = SpeechSynthesisService.getInstance();
    setTesting(true);
    tts.speak("Привет! Я JARVIS, ваш персональный ассистент. Голос настроен.", {
      rate: ttsRate,
      pitch: ttsPitch,
      volume: ttsVolume,
    });
    // Reset testing state after a reasonable time
    setTimeout(() => setTesting(false), 5000);
  }, [ttsRate, ttsPitch, ttsVolume]);

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
        <MicOff className="h-4 w-4 text-destructive" />
        <span className="font-mono text-[10px] text-destructive">
          Voice not supported in this browser
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-2">
      {/* Voice Enable Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 text-primary" />
          <div>
            <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
              Voice Pipeline
            </Label>
            <p className="font-mono text-[9px] text-muted-foreground/60">
              STT → AI → TTS
            </p>
          </div>
        </div>
        <Switch
          checked={voiceEnabled}
          onCheckedChange={(v) => {
            playSound(v ? "activate" : "deactivate");
            setVoiceEnabled(v);
          }}
        />
      </div>

      {voiceEnabled && (
        <>
          {/* Walkie-talkie mode */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
                Auto-Reactivate
              </Label>
              <p className="font-mono text-[9px] text-muted-foreground/60">
                Walkie-talkie mode — auto-listen after response
              </p>
            </div>
            <Switch
              checked={voiceAutoReactivate}
              onCheckedChange={(v) => {
                playSound("click");
                setVoiceAutoReactivate(v);
              }}
            />
          </div>

          {/* STT Language */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
              STT Language
            </Label>
            <div className="grid grid-cols-2 gap-1">
              {STT_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`rounded-md border px-2 py-1.5 text-left font-mono text-[10px] transition ${
                    sttLanguage === lang.code
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-jarvis-border-cyan/30 bg-muted/20 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Selection */}
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
              TTS Voice
            </Label>
            {voices.length === 0 ? (
              <span className="font-mono text-[9px] text-muted-foreground/60">
                No voices available
              </span>
            ) : (
              <select
                value={selectedVoiceIndex}
                onChange={(e) => handleVoiceChange(Number(e.target.value))}
                className="w-full rounded-md border jarvis-border-cyan bg-muted/20 px-2 py-1.5 font-mono text-[10px] text-foreground/90 focus:border-primary/50 focus:outline-none"
              >
                {voices.map((v, i) => (
                  <option key={`${v.name}-${i}`} value={i}>
                    {v.name} ({v.lang}){v.localService ? " [local]" : " [network]"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Rate Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
                Rate
              </Label>
              <span className="font-mono text-[9px] text-primary">
                {ttsRate.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[ttsRate]}
              min={0.5}
              max={2.0}
              step={0.05}
              onValueChange={([v]) => setTtsRate(v)}
              className="py-1"
            />
          </div>

          {/* Pitch Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
                Pitch
              </Label>
              <span className="font-mono text-[9px] text-primary">
                {ttsPitch.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[ttsPitch]}
              min={0.5}
              max={2.0}
              step={0.05}
              onValueChange={([v]) => setTtsPitch(v)}
              className="py-1"
            />
          </div>

          {/* Volume Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
                Volume
              </Label>
              <span className="font-mono text-[9px] text-primary">
                {Math.round(ttsVolume * 100)}%
              </span>
            </div>
            <Slider
              value={[ttsVolume]}
              min={0}
              max={1.0}
              step={0.05}
              onValueChange={([v]) => setTtsVolume(v)}
              className="py-1"
            />
          </div>

          {/* Test Voice Button */}
          <Button
            onClick={handleTestVoice}
            disabled={testing}
            className="w-full gap-2 rounded-lg border jarvis-border-cyan bg-primary/15 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/25 hover:jarvis-box-glow"
          >
            <Play className="h-3.5 w-3.5" />
            {testing ? "Speaking..." : "Test Voice"}
          </Button>
        </>
      )}
    </div>
  );
}