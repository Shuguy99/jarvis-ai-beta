"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { playSound } from "@/lib/sounds";
import { Volume2, Cpu, Sliders, Save, Check } from "lucide-react";

export interface JarvisSettingsData {
  ttsRate: number;
  ttsPitch: number;
  volume: number;
  autoSpeak: boolean;
  language: string;
}

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (settings: JarvisSettingsData) => void;
}

const DEFAULTS: JarvisSettingsData = {
  ttsRate: 1.05,
  ttsPitch: 0.95,
  volume: 1.0,
  autoSpeak: true,
  language: "ru",
};

export function SettingsPanel({ open, onOpenChange, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState<JarvisSettingsData>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load settings on mount or open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/jarvis/settings");
        const data = await res.json();
        if (cancelled) return;

        const s = data.settings as Record<string, string> | undefined;
        if (s) {
          setSettings({
            ttsRate: parseFloat(s.ttsRate) || DEFAULTS.ttsRate,
            ttsPitch: parseFloat(s.ttsPitch) || DEFAULTS.ttsPitch,
            volume: parseFloat(s.volume) ?? DEFAULTS.volume,
            autoSpeak: s.autoSpeak !== "false",
            language: s.language || DEFAULTS.language,
          });
        }
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (v) {
        playSound("click");
        setSaved(false);
      }
      onOpenChange(v);
    },
    [onOpenChange]
  );

  const update = useCallback(<K extends keyof JarvisSettingsData>(key: K, value: JarvisSettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/jarvis/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            ttsRate: String(settings.ttsRate),
            ttsPitch: String(settings.ttsPitch),
            volume: String(settings.volume),
            autoSpeak: String(settings.autoSpeak),
            language: settings.language,
          },
        }),
      });
      if (!res.ok) throw new Error("Save failed");

      playSound("success");
      setSaved(true);
      onSave?.(settings);
      setTimeout(() => {
        setSaved(false);
        onOpenChange(false);
      }, 800);
    } catch {
      playSound("error");
    } finally {
      setSaving(false);
    }
  }, [settings, onSave, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="jarvis-box-glow jarvis-corner-brackets max-h-[85vh] overflow-hidden rounded-xl border jarvis-border-cyan bg-card/95 p-0 backdrop-blur-xl sm:max-w-[480px]"
        showCloseButton={false}
      >
        {/* JARVIS header bar */}
        <div className="relative border-b jarvis-border-cyan bg-primary/5 px-5 py-3">
          <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-t-xl" />
          <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-30" />
          <DialogHeader className="relative flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border jarvis-border-cyan bg-primary/15">
                <Sliders className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary jarvis-glow">
                  System Configuration
                </DialogTitle>
                <DialogDescription className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
                  JARVIS Core Parameters
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => handleOpenChange(false)}
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition hover:text-primary"
            >
              [ESC]
            </button>
          </DialogHeader>
        </div>

        {/* Scrollable content */}
        <div className="jarvis-scroll max-h-[65vh] space-y-0 overflow-y-auto p-5">
          {/* Section 1: Голос / Voice */}
          <SettingsSection
            icon={<Volume2 className="h-3.5 w-3.5" />}
            title="Голос"
            subtitle="Voice Synthesis"
          >
            <SliderRow
              label="TTS Rate"
              value={settings.ttsRate}
              min={0.5}
              max={2.0}
              step={0.05}
              displayValue={settings.ttsRate.toFixed(2)}
              onChange={(v) => update("ttsRate", v)}
            />
            <SliderRow
              label="Pitch"
              value={settings.ttsPitch}
              min={0.5}
              max={2.0}
              step={0.05}
              displayValue={settings.ttsPitch.toFixed(2)}
              onChange={(v) => update("ttsPitch", v)}
            />
            <SliderRow
              label="Volume"
              value={settings.volume}
              min={0}
              max={1.0}
              step={0.05}
              displayValue={Math.round(settings.volume * 100) + "%"}
              onChange={(v) => update("volume", v)}
            />
          </SettingsSection>

          {/* Section 2: Система / System */}
          <SettingsSection
            icon={<Cpu className="h-3.5 w-3.5" />}
            title="Система"
            subtitle="Neural Core"
          >
            <div className="py-2">
              <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
                AI Provider
              </div>
              <div className="mt-1 rounded-md border jarvis-border-cyan bg-primary/10 px-3 py-2 font-mono text-[11px] text-primary">
                J.A.R.V.I.S. AI — Ready
              </div>
              <div className="mt-1 font-mono text-[9px] text-muted-foreground/50">
                Chat • Vision • Image Gen • Search • TTS • ASR
              </div>
            </div>
          </SettingsSection>

          {/* Section 3: Поведение / Behavior */}
          <SettingsSection
            icon={<Sliders className="h-3.5 w-3.5" />}
            title="Поведение"
            subtitle="Behavior"
          >
            <ToggleRow
              label="Auto-speak"
              description="Авто-озвучка ответов"
              checked={settings.autoSpeak}
              onCheckedChange={(v) => update("autoSpeak", v)}
            />
            <div className="flex items-center justify-between gap-4 py-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
                  Language
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/60">Язык интерфейса</div>
              </div>
              <div className="flex items-center gap-1 rounded-lg border jarvis-border-cyan bg-muted/30 p-0.5">
                {(["ru", "en"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => update("language", lang)}
                    className={`rounded-md px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
                      settings.language === lang
                        ? "bg-primary/20 text-primary jarvis-box-glow"
                        : "text-muted-foreground hover:text-foreground/80"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </SettingsSection>
        </div>

        {/* Footer */}
        <div className="border-t jarvis-border-cyan bg-primary/5 px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
              {loaded ? "settings loaded" : "loading..."}
            </span>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="jarvis-box-glow gap-2 rounded-lg border jarvis-border-cyan bg-primary/15 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/25"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Saved
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  {saving ? "Saving..." : "Save Config"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function SettingsSection({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <div className="mb-3 flex items-center gap-2 border-b border-dashed jarvis-border-cyan/50 pb-2">
        <div className="text-primary/70">{icon}</div>
        <div>
          <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/90">
            {title}
          </div>
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            {subtitle}
          </div>
        </div>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-2">
      <div className="mb-2 flex items-center justify-between">
        <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
          {label}
        </Label>
        <span className="min-w-[3rem] text-right font-mono text-[10px] tabular-nums text-primary/80">
          {displayValue}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="py-1"
      />
      <div className="mt-0.5 flex justify-between font-mono text-[8px] text-muted-foreground/40">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function InputRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="py-2">
      <Label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-foreground/80">
        {label}
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[11px] text-foreground/90 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/30"
      />
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
          {label}
        </div>
        <div className="font-mono text-[9px] text-muted-foreground/60">{description}</div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-primary"
      />
    </div>
  );
}