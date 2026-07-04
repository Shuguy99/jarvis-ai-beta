"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { playSound } from "@/lib/sounds";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  type ThemeDefinition,
  getCustomThemes,
  deleteCustomTheme,
  applyTheme,
} from "@/lib/theme-engine";
import { Plus, Trash2 } from "lucide-react";

// ── Built-in themes (unchanged from original) ─────────────────

const THEMES = [
  {
    id: "mark1" as const,
    label: "MARK 1",
    color: "oklch(0.85 0.19 193)",
    glowColor: "oklch(0.85 0.19 193 / 50%)",
  },
  {
    id: "mark42" as const,
    label: "MARK 42",
    color: "oklch(0.85 0.18 85)",
    glowColor: "oklch(0.85 0.18 85 / 50%)",
  },
  {
    id: "mark50" as const,
    label: "MARK 50",
    color: "oklch(0.75 0.22 25)",
    glowColor: "oklch(0.75 0.22 25 / 50%)",
  },
] as const;

type ThemeId = (typeof THEMES)[number]["id"];

// ── Helpers ───────────────────────────────────────────────────

function getInitialTheme(): ThemeId {
  if (typeof window === "undefined") return "mark1";
  const stored = localStorage.getItem("jarvis-theme") as ThemeId | null;
  return stored && THEMES.some((t) => t.id === stored) ? stored : "mark1";
}

// ── Component ─────────────────────────────────────────────────

interface ThemeSwitcherProps {
  onOpenEditor?: () => void;
}

export function ThemeSwitcher({ onOpenEditor }: ThemeSwitcherProps) {
  const [active, setActive] = useState<ThemeId>(getInitialTheme);
  const [customThemes, setCustomThemes] = useState<ThemeDefinition[]>([]);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const initialized = useRef(false);

  // Load custom themes from storage
  const refreshCustomThemes = useCallback(() => {
    setCustomThemes(getCustomThemes());
  }, []);

  useEffect(() => {
    refreshCustomThemes();
  }, [refreshCustomThemes]);

  // Apply initial theme on mount (original logic preserved)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    document.documentElement.setAttribute("data-theme", active);
  }, [active]);

  // Switch to a builtin theme (original logic preserved)
  const setTheme = useCallback((id: ThemeId) => {
    if (id === active) return;
    playSound("click");
    setActive(id);
    localStorage.setItem("jarvis-theme", id);
    document.documentElement.setAttribute("data-theme", id);
  }, [active]);

  // Switch to a custom theme
  const setCustomTheme = useCallback((theme: ThemeDefinition) => {
    playSound("click");
    setActive("mark1" as ThemeId); // reset builtin indicator
    localStorage.setItem("jarvis-theme", theme.id);
    applyTheme(theme);
    setCustomPopoverOpen(false);
  }, []);

  // Delete a custom theme
  const handleDeleteCustom = useCallback((id: string) => {
    deleteCustomTheme(id);
    refreshCustomThemes();
    playSound("click");
  }, [refreshCustomThemes]);

  // Open editor
  const handleOpenEditor = useCallback(() => {
    playSound("click");
    setCustomPopoverOpen(false);
    onOpenEditor?.();
  }, [onOpenEditor]);

  return (
    <div className="inline-flex items-center gap-3 rounded-md border px-3 py-2 jarvis-border-cyan font-mono text-[10px] uppercase tracking-widest">
      <span className="text-muted-foreground mr-1 select-none">SUIT</span>

      {/* ── Built-in theme buttons (original, untouched) ── */}
      {THEMES.map((theme) => {
        const isActive = active === theme.id;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => setTheme(theme.id)}
            className="flex flex-col items-center gap-1.5 cursor-pointer"
            title={`Switch to ${theme.label} theme`}
          >
            <span
              className="block h-4 w-4 rounded-full transition-all duration-200"
              style={{
                backgroundColor: theme.color,
                boxShadow: isActive
                  ? `0 0 8px ${theme.glowColor}, 0 0 18px ${theme.glowColor}, 0 0 32px ${theme.glowColor}`
                  : `0 0 4px ${theme.glowColor}`,
                outline: isActive
                  ? `1.5px solid ${theme.color}`
                  : "1.5px solid transparent",
                outlineOffset: "2px",
                transform: isActive ? "scale(1.15)" : "scale(1)",
              }}
            />
            <span
              className="select-none leading-none"
              style={{
                color: isActive ? theme.color : undefined,
                opacity: isActive ? 1 : 0.4,
              }}
            >
              {theme.label}
            </span>
          </button>
        );
      })}

      {/* ── Custom themes popover + add button ── */}
      <Popover open={customPopoverOpen} onOpenChange={setCustomPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={() => setCustomPopoverOpen((v) => !v)}
            className="flex flex-col items-center gap-1.5 cursor-pointer group"
            title="Custom themes"
          >
            <span
              className="flex items-center justify-center h-4 w-4 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/60 group-hover:border-primary/60 group-hover:text-primary/80 transition-all duration-200"
            >
              <Plus className="h-3 w-3" />
            </span>
            <span className="select-none leading-none text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors">
              CUSTOM
            </span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-64 bg-background/95 backdrop-blur-xl border border-border jarvis-box-glow font-mono p-0"
        >
          <div className="p-3 border-b border-border/50">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              Custom Themes
            </div>

            {/* Create new button */}
            <button
              type="button"
              onClick={handleOpenEditor}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-[11px] text-foreground/80 hover:bg-accent/20 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="uppercase tracking-wider">Create New Theme</span>
            </button>
          </div>

          {/* Custom themes list */}
          <div className="max-h-48 overflow-y-auto jarvis-scroll">
            {customThemes.length === 0 ? (
              <div className="p-3 text-[10px] text-muted-foreground/50 italic text-center">
                No custom themes
              </div>
            ) : (
              customThemes.map((ct) => (
                <div
                  key={ct.id}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-accent/10 transition-colors group cursor-pointer"
                  onClick={() => setCustomTheme(ct)}
                >
                  {/* Color swatch */}
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-border"
                    style={{ backgroundColor: ct.colors.primary }}
                  />
                  {/* Name */}
                  <span className="flex-1 text-[11px] uppercase tracking-wider text-foreground/80 truncate">
                    {ct.name}
                  </span>
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustom(ct.id);
                    }}
                    className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/20 transition-all cursor-pointer"
                    title={`Delete ${ct.name}`}
                  >
                    <Trash2 className="h-3 w-3 text-destructive/70" />
                  </button>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}