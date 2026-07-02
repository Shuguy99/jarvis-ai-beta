"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid,
  Eye,
  EyeOff,
  GripVertical,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Check,
  Monitor,
  Code,
  Target,
  Activity,
  Minimize2,
  X,
  ArrowLeft,
  Columns3,
} from "lucide-react";
import { useLayout, type LayoutPreset } from "@/hooks/use-layout";
import { playSound } from "@/lib/sounds";

// ─── Icon map for presets ────────────────────────────────────────────────────

const PRESET_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor,
  Minimize2,
  Code,
  Target,
  Activity,
};

// ─── Position labels ────────────────────────────────────────────────────────

const POSITION_LABELS: Record<string, string> = {
  left: "Левая",
  center: "Центр",
  right: "Правая",
};

const POSITION_COLORS: Record<string, string> = {
  left: "text-sky-400 border-sky-500/30 bg-sky-500/10",
  center: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  right: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
};

// ─── Component ──────────────────────────────────────────────────────────────

interface LayoutCustomizerProps {
  open: boolean;
  onClose: () => void;
}

export function LayoutCustomizer({ open, onClose }: LayoutCustomizerProps) {
  const {
    widgets,
    setWidgetVisible,
    setWidgetPosition,
    moveWidget,
    applyPreset,
    presets,
    activePresetId,
    resetToDefault,
  } = useLayout();

  const [savedIndicator, setSavedIndicator] = useState(true);

  // Show auto-save flash on change
  useEffect(() => {
    setSavedIndicator(true);
    const t = setTimeout(() => setSavedIndicator(false), 1500);
    return () => clearTimeout(t);
  }, [widgets, activePresetId]);

  // Group and sort widgets by position
  const grouped = useMemo(() => {
    const positions: Array<"left" | "center" | "right"> = ["left", "center", "right"];
    return positions.map((pos) => {
      const items = widgets
        .filter((w) => w.position === pos)
        .sort((a, b) => a.order - b.order);
      return { position: pos, items };
    });
  }, [widgets]);

  const handlePresetClick = (presetId: string) => {
    playSound("click");
    applyPreset(presetId);
  };

  const handleToggleVisibility = (id: string, visible: boolean) => {
    playSound(visible ? "activate" : "deactivate");
    setWidgetVisible(id, visible);
  };

  const handleMove = (id: string, direction: "up" | "down") => {
    playSound("click");
    moveWidget(id, direction);
  };

  const handlePositionChange = (id: string, pos: "left" | "center" | "right") => {
    playSound("click");
    setWidgetPosition(id, pos);
  };

  const handleReset = () => {
    playSound("shutdown");
    resetToDefault();
  };

  const handleClose = () => {
    playSound("deactivate");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-md"
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="jarvis-glass-strong relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border jarvis-border-cyan"
            style={{ boxShadow: "0 0 60px rgba(0, 255, 255, 0.08), inset 0 0 60px rgba(0, 255, 255, 0.03)" }}
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Decorative corner brackets */}
            <div className="pointer-events-none absolute left-2 top-2 h-5 w-5 border-l-2 border-t-2 border-primary/40" />
            <div className="pointer-events-none absolute right-2 top-2 h-5 w-5 border-r-2 border-t-2 border-primary/40" />
            <div className="pointer-events-none absolute bottom-2 left-2 h-5 w-5 border-b-2 border-l-2 border-primary/40" />
            <div className="pointer-events-none absolute bottom-2 right-2 h-5 w-5 border-b-2 border-r-2 border-primary/40" />

            {/* ─── Header ─── */}
            <div className="relative flex items-center justify-between border-b jarvis-border-cyan px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <LayoutGrid className="h-5 w-5 text-primary anim-data-pulse" />
                <div>
                  <h2 className="font-mono text-sm font-bold uppercase tracking-widest text-primary jarvis-glow">
                    Layout Config
                  </h2>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Настройка виджетов и пресеты интерфейса
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Auto-saved indicator */}
                <AnimatePresence mode="wait">
                  {savedIndicator && (
                    <motion.div
                      key="saved"
                      className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] text-emerald-400"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <Check className="h-3 w-3" />
                      <span>Авто-сохранено</span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-foreground/20 bg-muted/10 text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:bg-primary/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ─── Scrollable content ─── */}
            <div className="flex-1 overflow-y-auto jarvis-scroll p-5">
              {/* ─── Presets Row ─── */}
              <div className="mb-5">
                <div className="mb-2.5 flex items-center gap-2">
                  <Columns3 className="h-3.5 w-3.5 text-primary/60" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Пресеты
                  </span>
                </div>
                <div className="flex gap-2.5 overflow-x-auto pb-2 jarvis-scroll">
                  {presets.map((preset) => (
                    <PresetCard
                      key={preset.id}
                      preset={preset}
                      isActive={activePresetId === preset.id}
                      onClick={() => handlePresetClick(preset.id)}
                    />
                  ))}
                </div>
              </div>

              {/* ─── Widget Lists ─── */}
              {grouped.map(({ position, items }) => (
                <div key={position} className="mb-4 last:mb-0">
                  {/* Group header */}
                  <div className="mb-2 flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${
                      position === "left" ? "bg-sky-400" :
                      position === "center" ? "bg-violet-400" : "bg-emerald-400"
                    }`} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {POSITION_LABELS[position]} — {position === "center" ? "Всегда видимо" : `${items.filter(w => w.visible).length}/${items.length} видимо`}
                    </span>
                  </div>

                  {/* Widget items */}
                  <div className="max-h-[60vh] space-y-1 overflow-y-auto jarvis-scroll">
                    {items.map((widget) => (
                      <WidgetItem
                        key={widget.id}
                        id={widget.id}
                        name={widget.name}
                        visible={widget.visible}
                        pinned={widget.pinned ?? false}
                        position={widget.position}
                        isFirst={items[0]?.id === widget.id}
                        isLast={items[items.length - 1]?.id === widget.id}
                        onToggleVisibility={(v) => handleToggleVisibility(widget.id, v)}
                        onMove={(d) => handleMove(widget.id, d)}
                        onPositionChange={(p) => handlePositionChange(widget.id, p)}
                        isCenter={position === "center"}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Footer ─── */}
            <div className="relative flex items-center justify-between border-t jarvis-border-cyan px-5 py-3">
              <div className="font-mono text-[9px] text-muted-foreground/50">
                {widgets.filter((w) => w.visible).length} / {widgets.length} видимо
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-2 rounded-lg border border-muted-foreground/20 bg-muted/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Сбросить по умолчанию</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Preset Card ────────────────────────────────────────────────────────────

function PresetCard({
  preset,
  isActive,
  onClick,
}: {
  preset: LayoutPreset;
  isActive: boolean;
  onClick: () => void;
}) {
  const IconComponent = PRESET_ICONS[preset.icon] ?? Monitor;

  return (
    <motion.button
      onClick={onClick}
      className={`group relative flex min-w-[160px] flex-shrink-0 flex-col items-start gap-1.5 rounded-xl border p-3.5 text-left transition ${
        isActive
          ? "border-primary/60 bg-primary/10 shadow-[0_0_20px_rgba(0,255,255,0.1)]"
          : "border-muted-foreground/15 bg-card/40 hover:border-primary/30 hover:bg-primary/5"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {isActive && (
        <motion.div
          className="absolute -top-px -left-px -right-px -bottom-px rounded-xl border-2 border-primary/40"
          layoutId="preset-active-border"
          transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
        />
      )}
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
          isActive ? "bg-primary/20" : "bg-muted/30"
        }`}>
          <IconComponent className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <span className={`font-mono text-xs font-semibold uppercase tracking-wider ${
          isActive ? "text-primary" : "text-foreground/80"
        }`}>
          {preset.name}
        </span>
      </div>
      <p className="font-mono text-[9px] leading-relaxed text-muted-foreground">
        {preset.description}
      </p>
      <div className="mt-0.5 font-mono text-[9px] text-muted-foreground/50">
        {preset.layout.filter((w) => w.visible).length} виджетов
      </div>
    </motion.button>
  );
}

// ─── Widget Item ────────────────────────────────────────────────────────────

function WidgetItem({
  id,
  name,
  visible,
  pinned,
  position,
  isFirst,
  isLast,
  onToggleVisibility,
  onMove,
  onPositionChange,
  isCenter,
}: {
  id: string;
  name: string;
  visible: boolean;
  pinned: boolean;
  position: string;
  isFirst: boolean;
  isLast: boolean;
  onToggleVisibility: (v: boolean) => void;
  onMove: (d: "up" | "down") => void;
  onPositionChange: (p: "left" | "center" | "right") => void;
  isCenter: boolean;
}) {
  return (
    <motion.div
      layout
      className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
        visible
          ? "border-primary/15 bg-card/40"
          : "border-muted-foreground/10 bg-muted/10 opacity-50"
      }`}
    >
      {/* Drag handle / Grip */}
      <GripVertical className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/30" />

      {/* Widget name */}
      <span className={`flex-1 font-mono text-[11px] uppercase tracking-wider truncate ${
        visible ? "text-foreground/90" : "text-muted-foreground/40 line-through"
      }`}>
        {name}
      </span>

      {/* Position badge (for non-center) */}
      {!isCenter && (
        <div className="flex items-center gap-1">
          {(["left", "right"] as const).map((pos) => (
            <button
              key={pos}
              onClick={() => onPositionChange(pos)}
              title={`Переместить: ${POSITION_LABELS[pos]}`}
              className={`flex h-6 items-center gap-1 rounded-md border px-1.5 font-mono text-[9px] uppercase tracking-wider transition ${
                position === pos
                  ? POSITION_COLORS[pos]
                  : "border-muted-foreground/10 bg-transparent text-muted-foreground/30 hover:text-muted-foreground/60"
              }`}
            >
              {pos === "left" ? (
                <ArrowLeft className="h-2.5 w-2.5" />
              ) : null}
              {POSITION_LABELS[pos].charAt(0)}
            </button>
          ))}
        </div>
      )}

      {/* Up / Down arrows (for non-pinned) */}
      {!pinned && !isCenter && (
        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMove("up")}
            disabled={isFirst}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition hover:bg-primary/10 hover:text-primary disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/40"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onMove("down")}
            disabled={isLast}
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 transition hover:bg-primary/10 hover:text-primary disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-muted-foreground/40"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Eye toggle */}
      {!pinned ? (
        <button
          onClick={() => onToggleVisibility(!visible)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
            visible
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-muted-foreground/10 bg-transparent text-muted-foreground/40 hover:text-muted-foreground"
          }`}
          title={visible ? "Скрыть" : "Показать"}
        >
          {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/20 bg-primary/5">
          <Check className="h-3.5 w-3.5 text-primary/60" />
        </div>
      )}
    </motion.div>
  );
}