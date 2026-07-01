"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { playSound } from "@/lib/sounds";

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

function getInitialTheme(): ThemeId {
  if (typeof window === "undefined") return "mark1";
  const stored = localStorage.getItem("jarvis-theme") as ThemeId | null;
  return stored && THEMES.some((t) => t.id === stored) ? stored : "mark1";
}

export function ThemeSwitcher() {
  const [active, setActive] = useState<ThemeId>(getInitialTheme);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    document.documentElement.setAttribute("data-theme", active);
  }, [active]);

  const setTheme = useCallback((id: ThemeId) => {
    if (id === active) return;
    playSound("click");
    setActive(id);
    localStorage.setItem("jarvis-theme", id);
    document.documentElement.setAttribute("data-theme", id);
  }, [active]);

  return (
    <div className="inline-flex items-center gap-3 rounded-md border px-3 py-2 jarvis-border-cyan font-mono text-[10px] uppercase tracking-widest">
      <span className="text-muted-foreground mr-1 select-none">SUIT</span>
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
    </div>
  );
}