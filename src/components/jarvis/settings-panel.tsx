

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
import { Textarea } from "@/components/ui/textarea";
import { playSound } from "@/lib/sounds";
import { UserProfileSwitcher } from "@/components/jarvis/user-profile-switcher";
import { BotSettings } from "@/components/jarvis/bot-settings";
import { AuditLogViewer } from "@/components/jarvis/audit-log-viewer";
import { auditLog } from "@/lib/security-audit";
import { CommunityThemesGallery } from "@/components/jarvis/community-themes-gallery";
import {
  Volume2,
  Cpu,
  Sliders,
  Save,
  Check,
  Brain,
  User,
  MessageSquare,
  Sparkles,
  Thermometer,
  BookOpen,
  FileText,
  RotateCcw,
  Wifi,
  WifiOff,
  Loader2,
  Shield,
  Bot,
} from "lucide-react";

// ─── Persona presets ──────────────────────────────────────────────

export const PERSONA_PRESETS = [
  {
    id: "classic" as const,
    name: "Classic JARVIS",
    icon: "🤖",
    desc: "Спокойный, британский юмор, учтивость",
    formality: 0.7,
    humor: 0.4,
    responseStyle: "standard" as const,
  },
  {
    id: "military" as const,
    name: "Military Mode",
    icon: "🎖️",
    desc: "Строгий, лаконичный, тактический",
    formality: 1.0,
    humor: 0.0,
    responseStyle: "concise" as const,
  },
  {
    id: "casual" as const,
    name: "Casual Buddy",
    icon: "😎",
    desc: "Расслабленный, дружелюбный, неформальный",
    formality: 0.2,
    humor: 0.8,
    responseStyle: "standard" as const,
  },
  {
    id: "scientist" as const,
    name: "Dr. JARVIS",
    icon: "🔬",
    desc: "Научный, точный, детальный",
    formality: 0.8,
    humor: 0.2,
    responseStyle: "detailed" as const,
  },
  {
    id: "creative" as const,
    name: "Creative Muse",
    icon: "✨",
    desc: "Творческий, вдохновляющий, образный",
    formality: 0.3,
    humor: 0.6,
    responseStyle: "detailed" as const,
  },
  {
    id: "custom" as const,
    name: "Custom",
    icon: "⚙️",
    desc: "Свои настройки + кастомный промт",
    formality: 0.5,
    humor: 0.3,
    responseStyle: "standard" as const,
  },
];

export type PersonaId = (typeof PERSONA_PRESETS)[number]["id"];
export type ResponseStyle = "concise" | "standard" | "detailed" | "technical";

const RESPONSE_STYLES: { id: ResponseStyle; label: string; desc: string }[] = [
  { id: "concise", label: "Кратко", desc: "1-2 предложения" },
  { id: "standard", label: "Стандарт", desc: "Обычный ответ" },
  { id: "detailed", label: "Подробно", desc: "Развёрнутый" },
  { id: "technical", label: "Технично", desc: "С деталями и кодом" },
];

// ─── Settings type ───────────────────────────────────────────────

export interface JarvisSettingsData {
  // Voice
  ttsRate: number;
  ttsPitch: number;
  volume: number;
  autoSpeak: boolean;
  language: string;
  // Behavior
  persona: PersonaId;
  userName: string;
  formality: number;
  humor: number;
  responseStyle: ResponseStyle;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  customPrompt: string;
}

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (settings: JarvisSettingsData) => void;
}

interface ProviderInfo {
  id: string;
  name: string;
  envKeys: string[];
  defaultModel: string;
  supports: { chat: boolean; vision: boolean; imageGen: boolean };
  configured: boolean;
}

const VOICE_DEFAULTS: Omit<JarvisSettingsData, keyof typeof BEHAVIOR_DEFAULTS> = {
  ttsRate: 1.05,
  ttsPitch: 0.95,
  volume: 1.0,
  autoSpeak: true,
  language: "ru",
};

const BEHAVIOR_DEFAULTS = {
  persona: "classic" as PersonaId,
  userName: "",
  formality: 0.7,
  humor: 0.4,
  responseStyle: "standard" as ResponseStyle,
  temperature: 0.7,
  maxTokens: 2048,
  contextWindow: 20,
  customPrompt: "",
};

const DEFAULTS: JarvisSettingsData = { ...VOICE_DEFAULTS, ...BEHAVIOR_DEFAULTS };

function parseSetting(key: string, val: string): unknown {
  if (["ttsRate", "ttsPitch", "volume", "formality", "humor", "temperature"].includes(key)) {
    return parseFloat(val) || DEFAULTS[key as keyof JarvisSettingsData];
  }
  if (["maxTokens", "contextWindow"].includes(key)) {
    return parseInt(val, 10) || DEFAULTS[key as keyof JarvisSettingsData];
  }
  if (key === "autoSpeak") return val !== "false";
  return val || DEFAULTS[key as keyof JarvisSettingsData];
}

// ─── Component ───────────────────────────────────────────────────

export function SettingsPanel({ open, onOpenChange, onSave }: SettingsPanelProps) {
  const [settings, setSettings] = useState<JarvisSettingsData>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"voice" | "behavior" | "providers" | "integrations" | "security">("behavior");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);

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
            ...DEFAULTS,
            ttsRate: parseSetting("ttsRate", s.ttsRate) as number,
            ttsPitch: parseSetting("ttsPitch", s.ttsPitch) as number,
            volume: parseSetting("volume", s.volume) as number,
            autoSpeak: parseSetting("autoSpeak", s.autoSpeak) as boolean,
            language: (s.language || DEFAULTS.language) as string,
            persona: (s.persona || DEFAULTS.persona) as PersonaId,
            userName: s.userName || "",
            formality: parseSetting("formality", s.formality) as number,
            humor: parseSetting("humor", s.humor) as number,
            responseStyle: (s.responseStyle || DEFAULTS.responseStyle) as ResponseStyle,
            temperature: parseSetting("temperature", s.temperature) as number,
            maxTokens: parseSetting("maxTokens", s.maxTokens) as number,
            contextWindow: parseSetting("contextWindow", s.contextWindow) as number,
            customPrompt: s.customPrompt || "",
          });
        }
        setLoaded(true);
      } catch {
        setLoaded(true);
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  // Load providers when providers tab is opened
  useEffect(() => {
    if (!open || activeTab !== "providers") return;
    let cancelled = false;
    setProvidersLoading(true);

    (async () => {
      try {
        const res = await fetch("/api/jarvis/providers");
        const data = await res.json();
        if (cancelled) return;
        setProviders(data.catalog ?? []);
        setActiveProviderId(data.active?.id ?? null);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setProvidersLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, activeTab]);

  const switchProvider = useCallback(async (providerId: string) => {
    try {
      await fetch("/api/jarvis/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { aiProvider: providerId } }),
      });
      setActiveProviderId(providerId);
      auditLog("provider_change", "Провайдер изменён", `New provider: ${providerId}`);
      playSound("success");
    } catch {
      playSound("error");
    }
  }, []);

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

  const applyPreset = useCallback((preset: (typeof PERSONA_PRESETS)[number]) => {
    setSettings((prev) => ({
      ...prev,
      persona: preset.id,
      formality: preset.formality,
      humor: preset.humor,
      responseStyle: preset.responseStyle,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const s: Record<string, string> = {
        ttsRate: String(settings.ttsRate),
        ttsPitch: String(settings.ttsPitch),
        volume: String(settings.volume),
        autoSpeak: String(settings.autoSpeak),
        language: settings.language,
        persona: settings.persona,
        userName: settings.userName,
        formality: String(settings.formality),
        humor: String(settings.humor),
        responseStyle: settings.responseStyle,
        temperature: String(settings.temperature),
        maxTokens: String(settings.maxTokens),
        contextWindow: String(settings.contextWindow),
        customPrompt: settings.customPrompt,
      };

      const res = await fetch("/api/jarvis/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: s }),
      });
      if (!res.ok) throw new Error("Save failed");

      playSound("success");
      auditLog("settings_change", "Настройки сохранены");
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
        className="jarvis-box-glow jarvis-corner-brackets max-h-[90vh] overflow-hidden rounded-xl border jarvis-border-cyan bg-card/95 p-0 backdrop-blur-xl sm:max-w-[560px]"
        showCloseButton={false}
      >
        {/* ─── Header ─── */}
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

        {/* ─── Tab bar ─── */}
        <div className="flex border-b jarvis-border-cyan/50 bg-primary/3">
          <button
            onClick={() => { setActiveTab("behavior"); playSound("click"); }}
            className={`flex-1 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition ${
              activeTab === "behavior"
                ? "border-b-2 border-primary text-primary jarvis-glow bg-primary/5"
                : "text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Brain className="mr-1.5 inline h-3 w-3" />
            Модель поведения
          </button>
          <button
            onClick={() => { setActiveTab("voice"); playSound("click"); }}
            className={`flex-1 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition ${
              activeTab === "voice"
                ? "border-b-2 border-primary text-primary jarvis-glow bg-primary/5"
                : "text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Volume2 className="mr-1.5 inline h-3 w-3" />
            Голос & Система
          </button>
          <button
            onClick={() => { setActiveTab("providers"); playSound("click"); }}
            className={`flex-1 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition ${
              activeTab === "providers"
                ? "border-b-2 border-primary text-primary jarvis-glow bg-primary/5"
                : "text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Shield className="mr-1.5 inline h-3 w-3" />
            AI Провайдеры
          </button>
          <button
            onClick={() => { setActiveTab("security"); playSound("click"); }}
            className={`flex-1 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition ${
              activeTab === "security"
                ? "border-b-2 border-primary text-primary jarvis-glow bg-primary/5"
                : "text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Shield className="mr-1.5 inline h-3 w-3" />
            Безопасность
          </button>
          <button
            onClick={() => { setActiveTab("integrations"); playSound("click"); }}
            className={`flex-1 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest transition ${
              activeTab === "integrations"
                ? "border-b-2 border-primary text-primary jarvis-glow bg-primary/5"
                : "text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            <Bot className="mr-1.5 inline h-3 w-3" />
            Интеграции
          </button>
        </div>

        {/* ─── Scrollable content ─── */}
        <div className="jarvis-scroll max-h-[60vh] overflow-y-auto p-5">
          {activeTab === "behavior" && (
            <div className="space-y-0">
              {/* ── User Profiles ── */}
              <SettingsSection
                icon={<User className="h-3.5 w-3.5" />}
                title="Профили пользователей"
                subtitle="Multi-User Profiles"
              >
                <div className="py-1">
                  <UserProfileSwitcher />
                </div>
              </SettingsSection>

              {/* ── Persona Presets ── */}
              <SettingsSection
                icon={<Sparkles className="h-3.5 w-3.5" />}
                title="Персона"
                subtitle="Behavior Preset"
              >
                <div className="grid grid-cols-2 gap-2 py-1">
                  {PERSONA_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      className={`group relative rounded-lg border p-2.5 text-left transition ${
                        settings.persona === p.id
                          ? "border-primary/60 bg-primary/10 jarvis-box-glow"
                          : "border-jarvis-border-cyan/30 bg-muted/20 hover:border-primary/30 hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{p.icon}</span>
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/90">
                          {p.name}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[8px] leading-tight text-muted-foreground/60">
                        {p.desc}
                      </p>
                      {settings.persona === p.id && (
                        <div className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </button>
                  ))}
                </div>
              </SettingsSection>

              {/* ── User Identity ── */}
              <SettingsSection
                icon={<User className="h-3.5 w-3.5" />}
                title="Идентификация"
                subtitle="User Identity"
              >
                <InputRow
                  label="Имя пользователя"
                  value={settings.userName}
                  placeholder="Как к вам обращаться? (пусто = 'сэр')"
                  onChange={(v) => update("userName", v)}
                />
              </SettingsSection>

              {/* ── Personality Sliders ── */}
              <SettingsSection
                icon={<Brain className="h-3.5 w-3.5" />}
                title="Характер"
                subtitle="Personality Tuning"
              >
                <SliderRow
                  label="Формальность"
                  value={settings.formality}
                  min={0}
                  max={1}
                  step={0.05}
                  displayValue={settings.formality.toFixed(2)}
                  onChange={(v) => { update("formality", v); update("persona", "custom" as PersonaId); }}
                  leftLabel="Неформально"
                  rightLabel="Строго"
                />
                <SliderRow
                  label="Юмор"
                  value={settings.humor}
                  min={0}
                  max={1}
                  step={0.05}
                  displayValue={settings.humor.toFixed(2)}
                  onChange={(v) => { update("humor", v); update("persona", "custom" as PersonaId); }}
                  leftLabel="Серьёзно"
                  rightLabel="Остроумно"
                />
              </SettingsSection>

              {/* ── Response Style ── */}
              <SettingsSection
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                title="Стиль ответов"
                subtitle="Response Style"
              >
                <div className="grid grid-cols-2 gap-1.5 py-1">
                  {RESPONSE_STYLES.map((rs) => (
                    <button
                      key={rs.id}
                      onClick={() => { update("responseStyle", rs.id); update("persona", "custom" as PersonaId); }}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        settings.responseStyle === rs.id
                          ? "border-primary/60 bg-primary/10 jarvis-box-glow"
                          : "border-jarvis-border-cyan/30 bg-muted/20 hover:border-primary/30"
                      }`}
                    >
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/90">
                        {rs.label}
                      </div>
                      <div className="font-mono text-[8px] text-muted-foreground/50">{rs.desc}</div>
                    </button>
                  ))}
                </div>
              </SettingsSection>

              {/* ── AI Parameters ── */}
              <SettingsSection
                icon={<Thermometer className="h-3.5 w-3.5" />}
                title="Параметры ИИ"
                subtitle="AI Parameters"
              >
                <SliderRow
                  label="Температура"
                  value={settings.temperature}
                  min={0}
                  max={2.0}
                  step={0.05}
                  displayValue={settings.temperature.toFixed(2)}
                  onChange={(v) => update("temperature", v)}
                  leftLabel="Точно"
                  rightLabel="Креативно"
                />
                <SliderRow
                  label="Макс. токенов"
                  value={settings.maxTokens}
                  min={256}
                  max={8192}
                  step={256}
                  displayValue={String(settings.maxTokens)}
                  onChange={(v) => update("maxTokens", v)}
                />
                <SliderRow
                  label="Окно контекста"
                  value={settings.contextWindow}
                  min={4}
                  max={50}
                  step={2}
                  displayValue={`${settings.contextWindow} сообщ.`}
                  onChange={(v) => update("contextWindow", v)}
                />
              </SettingsSection>

              {/* ── Custom Prompt ── */}
              <SettingsSection
                icon={<FileText className="h-3.5 w-3.5" />}
                title="Кастомный промт"
                subtitle="Custom System Prompt"
              >
                <div className="py-1">
                  <p className="mb-2 font-mono text-[9px] text-muted-foreground/50">
                    Переопределите системный промт JARVIS полностью. Оставьте пустым — будет использован пресет.
                  </p>
                  <Textarea
                    value={settings.customPrompt}
                    onChange={(e) => { update("customPrompt", e.target.value); if (e.target.value) update("persona", "custom" as PersonaId); }}
                    placeholder="Вы — персональный ИИ-ассистент..."
                    rows={5}
                    className="min-h-[100px] resize-y rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[11px] text-foreground/90 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-primary/30"
                  />
                </div>
              </SettingsSection>

              {/* ── Community Themes ── */}
              <SettingsSection
                icon={<Sparkles className="h-3.5 w-3.5" />}
                title="Темы оформления"
                subtitle="Community Themes"
              >
                <div className="py-1">
                  <CommunityThemesGallery />
                </div>
              </SettingsSection>
            </div>
          )}

          {activeTab === "voice" && (
            <div className="space-y-0">
              {/* ── Voice ── */}
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

              {/* ── System ── */}
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
                    Ollama (Local AI)
                  </div>
                  <div className="mt-1 font-mono text-[9px] text-muted-foreground/50">
                    ✅ Chat • ✅ Vision • ✅ TTS • ✅ ASR • ❌ Search • ❌ Image Gen
                  </div>
                </div>
              </SettingsSection>

              {/* ── Behavior ── */}
              <SettingsSection
                icon={<BookOpen className="h-3.5 w-3.5" />}
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
          )}

          {activeTab === "providers" && (
            <div className="space-y-0">
              <SettingsSection
                icon={<Shield className="h-3.5 w-3.5" />}
                title="AI Провайдеры"
                subtitle="Active Provider Selection"
              >
                {providersLoading ? (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="font-mono text-[10px] text-muted-foreground">Загрузка...</span>
                  </div>
                ) : (
                  <div className="space-y-2 py-1">
                    {providers.map((p) => {
                      const isActive = activeProviderId === p.id;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { if (p.configured) switchProvider(p.id); }}
                          disabled={!p.configured}
                          className={`group relative flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                            !p.configured
                              ? "cursor-not-allowed border-muted/20 bg-muted/10 opacity-50"
                              : isActive
                                ? "border-primary/60 bg-primary/10 jarvis-box-glow"
                                : "border-jarvis-border-cyan/30 bg-muted/20 hover:border-primary/30 hover:bg-primary/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                              isActive ? "border-primary bg-primary/20" : "border-muted/30 bg-muted/30"
                            }`}>
                              {p.configured ? (
                                <Wifi className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                              ) : (
                                <WifiOff className="h-3.5 w-3.5 text-muted-foreground/40" />
                              )}
                            </div>
                            <div>
                              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/90">
                                {p.name}
                              </div>
                              <div className="font-mono text-[8px] text-muted-foreground/60">
                                {p.configured
                                  ? `Model: ${p.defaultModel}`
                                  : `Требуется: ${p.envKeys.join(", ")}`
                                }
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              {p.supports.chat && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[7px] uppercase text-primary">Chat</span>
                              )}
                              {p.supports.vision && (
                                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[7px] uppercase text-emerald-400">Vision</span>
                              )}
                              {p.supports.imageGen && (
                                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[7px] uppercase text-amber-400">ImgGen</span>
                              )}
                            </div>
                            {isActive && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </SettingsSection>
            </div>
          )}

          {activeTab === "integrations" && (
            <div className="space-y-0">
              <SettingsSection
                icon={<Bot className="h-3.5 w-3.5" />}
                title="Бот-интеграции"
                subtitle="Telegram & Discord"
              >
                <BotSettings />
              </SettingsSection>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-0">
              <AuditLogViewer />
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="border-t jarvis-border-cyan bg-primary/5 px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                {loaded ? "settings loaded" : "loading..."}
              </span>
              <button
                onClick={() => { setSettings(DEFAULTS); playSound("click"); }}
                className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40 transition hover:text-warning"
                title="Сбросить к настройкам по умолчанию"
              >
                <RotateCcw className="h-2.5 w-2.5" /> Reset
              </button>
            </div>
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
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div className="py-2">
      <div className="mb-2 flex items-center justify-between">
        <Label className="font-mono text-[10px] uppercase tracking-widest text-foreground/80">
          {label}
        </Label>
        <span className="min-w-[4rem] text-right font-mono text-[10px] tabular-nums text-primary/80">
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
        <span>{leftLabel ?? min}</span>
        <span>{rightLabel ?? max}</span>
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