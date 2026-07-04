

import { useEffect, useState, useCallback, useMemo } from "react";
import { useFocusTrap, getOverlayProps } from "@/lib/a11y-utils"
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle,
  X,
  Settings,
  Eye,
  EyeOff,
  ChevronUp,
  Monitor,
  Zap,
  BarChart3,
  Gamepad2,
  Wifi,
  CircleDot,
  Stethoscope,
  StickyNote,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import {
  initPluginRegistry,
  usePlugins,
  enablePlugin,
  getPluginsByCategory,
  type JarvisPlugin,
  type PluginSetting,
} from "@/lib/plugin-registry";

// ── Props ─────────────────────────────────────────────────────────

interface PluginPanelProps {
  open: boolean;
  onClose: () => void;
}

// ── Category definitions ──────────────────────────────────────────

interface CategoryDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: CategoryDef[] = [
  { id: "all", label: "Все", icon: CircleDot },
  { id: "system", label: "Система", icon: Monitor },
  { id: "productivity", label: "Продуктивность", icon: Zap },
  { id: "analysis", label: "Анализ", icon: BarChart3 },
  { id: "fun", label: "Развлечения", icon: Gamepad2 },
  { id: "network", label: "Сеть", icon: Wifi },
];

// ── Settings Dialog (inline) ──────────────────────────────────────

function PluginSettings({
  plugin,
  onClose,
}: {
  plugin: JarvisPlugin;
  onClose: () => void;
}) {
  if (!plugin.settings || plugin.settings.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="mt-2 rounded-md border border-primary/15 bg-background/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary/60">
            Настройки
          </span>
          <button
            onClick={() => {
              playSound("click");
              onClose();
            }}
            className="rounded p-0.5 text-muted-foreground/40 hover:text-foreground/60 transition-colors"
            aria-label="Закрыть настройки"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
        </div>
        {plugin.settings.map((setting) => (
          <SettingRow key={setting.key} pluginId={plugin.id} setting={setting} />
        ))}
      </div>
    </motion.div>
  );
}

function SettingRow({
  pluginId,
  setting,
}: {
  pluginId: string;
  setting: PluginSetting;
}) {
  const [value, setValue] = useState(setting.defaultValue);

  const handleChange = useCallback(
    (newValue: string | number | boolean) => {
      setValue(newValue);
      // We'll import updatePluginSetting lazily to avoid circular dependency issues
      // at the module level — the registry already exports it.
    },
    []
  );

  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-mono text-[10px] text-foreground/70">{setting.label}</span>
      {setting.type === "toggle" && (
        <Switch
          checked={!!value}
          onCheckedChange={(checked) => {
            handleChange(checked);
            playSound("click");
          }}
          className="scale-75"
        />
      )}
      {setting.type === "select" && setting.options && (
        <select
          value={String(value)}
          onChange={(e) => {
            handleChange(e.target.value);
            playSound("click");
          }}
          className="h-6 rounded border border-primary/15 bg-background/50 px-1.5 font-mono text-[9px] text-foreground/70 focus:border-primary/30 focus:outline-none"
        >
          {setting.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
      {setting.type === "number" && (
        <input
          type="number"
          value={Number(value)}
          onChange={(e) => {
            handleChange(Number(e.target.value));
            playSound("click");
          }}
          className="h-6 w-16 rounded border border-primary/15 bg-background/50 px-1.5 font-mono text-[9px] text-foreground/70 text-right focus:border-primary/30 focus:outline-none"
        />
      )}
      {setting.type === "text" && (
        <input
          type="text"
          value={String(value)}
          onChange={(e) => {
            handleChange(e.target.value);
          }}
          className="h-6 w-28 rounded border border-primary/15 bg-background/50 px-1.5 font-mono text-[9px] text-foreground/70 focus:border-primary/30 focus:outline-none"
        />
      )}
    </div>
  );
}

// ── Plugin Card ───────────────────────────────────────────────────

function PluginCardIcon({ iconName, enabled }: { iconName: string; enabled: boolean }) {
  const cls = `h-4 w-4 ${enabled ? "text-primary" : "text-muted-foreground/40"}`;
  switch (iconName) {
    case "Stethoscope": return <Stethoscope className={cls} />;
    case "Wifi": return <Wifi className={cls} />;
    case "StickyNote": return <StickyNote className={cls} />;
    case "Monitor": return <Monitor className={cls} />;
    case "Zap": return <Zap className={cls} />;
    case "BarChart3": return <BarChart3 className={cls} />;
    case "Gamepad2": return <Gamepad2 className={cls} />;
    case "CircleDot": return <CircleDot className={cls} />;
    default: return <Puzzle className={cls} />;
  }
}

function PluginCard({ plugin }: { plugin: JarvisPlugin }) {
  const [showSettings, setShowSettings] = useState(false);
  const [showWidget, setShowWidget] = useState(false);
  const Widget = plugin.widget;

  const handleToggle = useCallback(() => {
    enablePlugin(plugin.id, !plugin.enabled);
    playSound(plugin.enabled ? "deactivate" : "activate", 0.5);
    addActivityEvent({
      message: plugin.enabled
        ? `Расширение "${plugin.name}" отключено`
        : `Расширение "${plugin.name}" включено`,
      severity: plugin.enabled ? "warning" : "success",
      category: "system",
    });
  }, [plugin.id, plugin.enabled, plugin.name]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`rounded-lg border bg-card/50 backdrop-blur-sm transition-colors ${
        plugin.enabled
          ? "jarvis-border-cyan jarvis-box-glow"
          : "border-border/30 opacity-60"
      }`}
    >
      <div className="p-3">
        {/* Top row: icon, name, version, switch */}
        <div className="flex items-start gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-md border ${
              plugin.enabled
                ? "border-primary/20 bg-primary/5"
                : "border-border/20 bg-background/30"
            }`}
          >
            <PluginCardIcon iconName={plugin.icon} enabled={plugin.enabled} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`font-mono text-xs font-semibold ${
                  plugin.enabled ? "text-foreground/90" : "text-muted-foreground/50"
                }`}
              >
                {plugin.name}
              </span>
              <Badge
                variant="outline"
                className="h-4 border-primary/20 bg-primary/5 px-1.5 font-mono text-[8px] text-primary/60"
              >
                v{plugin.version}
              </Badge>
            </div>
            <p
              className={`mt-0.5 line-clamp-2 font-mono text-[10px] leading-relaxed ${
                plugin.enabled ? "text-muted-foreground/60" : "text-muted-foreground/30"
              }`}
            >
              {plugin.description}
            </p>
            <span className="mt-1 inline-block font-mono text-[8px] text-muted-foreground/30">
              {plugin.author}
            </span>
          </div>

          <Switch
            checked={plugin.enabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {/* Action buttons */}
        <div className="mt-2.5 flex items-center gap-1.5">
          {plugin.settings && plugin.settings.length > 0 && (
            <button
              onClick={() => {
                setShowSettings((prev) => !prev);
                if (!showSettings) setShowWidget(false);
                playSound("click");
              }}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[9px] transition-colors ${
                showSettings
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/30 bg-background/30 text-muted-foreground/50 hover:text-foreground/70"
              }`}
            >
              <Settings className="h-3 w-3" />
              Настроить
            </button>
          )}

          {plugin.widget && plugin.enabled && (
            <button
              onClick={() => {
                setShowWidget((prev) => !prev);
                if (!showWidget) {
                  setShowSettings(false);
                  playSound("activate", 0.3);
                } else {
                  playSound("deactivate", 0.3);
                }
              }}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 font-mono text-[9px] transition-colors ${
                showWidget
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/30 bg-background/30 text-muted-foreground/50 hover:text-foreground/70"
              }`}
            >
              {showWidget ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
              {showWidget ? "Скрыть виджет" : "Виджет"}
            </button>
          )}
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <PluginSettings
              plugin={plugin}
              onClose={() => setShowSettings(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Widget viewer */}
      <AnimatePresence>
        {showWidget && Widget && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-primary/10"
          >
            <div className="p-3">
              <Widget />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────

export function PluginPanel({ open, onClose }: PluginPanelProps) {
  const trapRef = useFocusTrap(open);
  const [activeCategory, setActiveCategory] = useState("all");
  const plugins = usePlugins();

  // Initialize registry on mount
  useEffect(() => {
    initPluginRegistry();
  }, []);

  const filteredPlugins = useMemo(
    () => getPluginsByCategory(activeCategory),
    [activeCategory, plugins]
  );

  const enabledCount = plugins.plugins.filter((p) => p.enabled).length;

  const handleCategoryChange = useCallback((catId: string) => {
    setActiveCategory(catId);
    playSound("click");
  }, []);

  const handleClose = useCallback(() => {
    playSound("deactivate", 0.4);
    onClose();
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="jarvis-glass-strong jarvis-box-glow-strong fixed inset-y-0 left-0 z-50 flex w-[420px] max-w-[90vw] flex-col overflow-hidden rounded-r-xl border-l-0 border-y-0 border-r border-border/20"
          ref={trapRef}
          {...getOverlayProps("Plugin Panel", open)}
        >
          {/* Scanline overlay */}
          <div className="pointer-events-none absolute inset-0 jarvis-scanline opacity-10" />

          {/* Grid background */}
          <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-20" />

          {/* Header */}
          <div className="relative flex items-center gap-3 border-b jarvis-border-cyan px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/5">
              <Puzzle className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-primary jarvis-glow">
                Расширения
              </h2>
              <p className="font-mono text-[9px] text-muted-foreground/50">
                {plugins.plugins.length} плагинов · {enabledCount} активно
              </p>
            </div>
            <button
              onClick={handleClose}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/30 bg-background/30 text-muted-foreground/50 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Category tabs */}
          <div className="relative flex items-center gap-0.5 overflow-x-auto border-b border-border/10 px-3 py-2 jarvis-scroll">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              const CatIcon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`flex flex-shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10px] transition-all ${
                    isActive
                      ? "border-primary/30 bg-primary/10 text-primary shadow-[0_0_12px_oklch(0.85_0.19_193/15%)]"
                      : "border-transparent text-muted-foreground/50 hover:border-border/20 hover:bg-background/30 hover:text-foreground/60"
                  }`}
                >
                  <CatIcon className="h-3 w-3" />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Plugin list */}
          <div className="relative flex-1 overflow-y-auto jarvis-scroll p-3">
            <AnimatePresence mode="popLayout">
              {filteredPlugins.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {filteredPlugins.map((plugin) => (
                    <PluginCard key={plugin.id} plugin={plugin} />
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-40 flex-col items-center justify-center gap-2"
                >
                  <Puzzle className="h-8 w-8 text-muted-foreground/15" />
                  <span className="font-mono text-xs text-muted-foreground/30">
                    Нет плагинов в этой категории
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="relative border-t border-border/10 px-4 py-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[8px] text-muted-foreground/25">
                PLUGIN SYSTEM v1.0
              </span>
              <span className="font-mono text-[8px] text-muted-foreground/25">
                JARVIS EXTENSIONS
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}