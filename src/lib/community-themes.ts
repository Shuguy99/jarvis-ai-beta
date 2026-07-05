/**
 * JARVIS Community Themes
 * Load, create, and share custom themes
 */

export interface ThemePreset {
  id: string;
  name: string;
  author: string;
  description: string;
  colors: {
    primary: string;
    background: string;
    foreground: string;
    card: string;
    muted: string;
    accent: string;
    border: string;
  };
  effects?: {
    glowIntensity?: number;    // 0-1
    particleDensity?: number;  // 0-1
    animationSpeed?: number;   // 0.5-2
  };
}

const STORAGE_KEY = "jarvis-custom-themes";

export const BUILTIN_THEMES: ThemePreset[] = [
  {
    id: "classic-cyan",
    name: "Classic Cyan",
    author: "JARVIS",
    description: "Стандартная тема JARVIS с голубым неоном",
    colors: {
      primary: "#00d4ff",
      background: "#0a0a1a",
      foreground: "#e0e0e0",
      card: "#0f1420",
      muted: "#6b7280",
      accent: "#00d4ff",
      border: "rgba(0, 212, 255, 0.2)",
    },
    effects: { glowIntensity: 0.8, particleDensity: 0.5, animationSpeed: 1 },
  },
  {
    id: "matrix-green",
    name: "Matrix",
    author: "Community",
    description: "Зелёная тема в стиле Матрицы",
    colors: {
      primary: "#00ff41",
      background: "#0a0a0a",
      foreground: "#00ff41",
      card: "#0d1a0d",
      muted: "#006600",
      accent: "#00ff41",
      border: "rgba(0, 255, 65, 0.2)",
    },
    effects: { glowIntensity: 1, particleDensity: 0.8, animationSpeed: 1.5 },
  },
  {
    id: "stark-red",
    name: "Stark Industries",
    author: "Community",
    description: "Красно-золотая тема Stark Industries",
    colors: {
      primary: "#ff3333",
      background: "#1a0a0a",
      foreground: "#f0d0c0",
      card: "#1a0f0f",
      muted: "#8b4513",
      accent: "#ffd700",
      border: "rgba(255, 51, 51, 0.2)",
    },
    effects: { glowIntensity: 0.6, particleDensity: 0.3, animationSpeed: 0.8 },
  },
  {
    id: "purple-reign",
    name: "Purple Reign",
    author: "Community",
    description: "Фиолетовая неоновая тема",
    colors: {
      primary: "#a855f7",
      background: "#0f0a1a",
      foreground: "#e0d0f0",
      card: "#150f20",
      muted: "#7c3aed",
      accent: "#c084fc",
      border: "rgba(168, 85, 247, 0.2)",
    },
    effects: { glowIntensity: 0.9, particleDensity: 0.6, animationSpeed: 1.2 },
  },
  {
    id: "midnight-blue",
    name: "Midnight Blue",
    author: "Community",
    description: "Тёмно-синяя спокойная тема",
    colors: {
      primary: "#3b82f6",
      background: "#0a0f1a",
      foreground: "#d0e0f0",
      card: "#0f1520",
      muted: "#1e40af",
      accent: "#60a5fa",
      border: "rgba(59, 130, 246, 0.2)",
    },
    effects: { glowIntensity: 0.5, particleDensity: 0.3, animationSpeed: 0.7 },
  },
  {
    id: "solar-orange",
    name: "Solar Flare",
    author: "Community",
    description: "Оранжево-тёплая тема",
    colors: {
      primary: "#f97316",
      background: "#1a100a",
      foreground: "#fde0c0",
      card: "#1a150f",
      muted: "#9a3412",
      accent: "#fb923c",
      border: "rgba(249, 115, 22, 0.2)",
    },
    effects: { glowIntensity: 0.7, particleDensity: 0.4, animationSpeed: 1 },
  },
];

export function getAllThemes(): ThemePreset[] {
  const custom = getCustomThemes();
  return [...BUILTIN_THEMES, ...custom];
}

export function getCustomThemes(): ThemePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomTheme(theme: ThemePreset) {
  const themes = getCustomThemes();
  const idx = themes.findIndex(t => t.id === theme.id);
  if (idx >= 0) themes[idx] = theme;
  else themes.push(theme);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(themes)); } catch { /* ignore */ }
}

export function deleteCustomTheme(id: string) {
  const themes = getCustomThemes().filter(t => t.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(themes)); } catch { /* ignore */ }
}

export function exportTheme(theme: ThemePreset): string {
  return JSON.stringify(theme, null, 2);
}

export function importTheme(json: string): ThemePreset | null {
  try {
    const theme = JSON.parse(json) as ThemePreset;
    if (!theme.id || !theme.name || !theme.colors?.primary) return null;
    saveCustomTheme(theme);
    return theme;
  } catch { return null; }
}

export function applyThemeToCSS(theme: ThemePreset) {
  const root = document.documentElement;
  const c = theme.colors;

  root.style.setProperty("--primary", c.primary);
  root.style.setProperty("--background", c.background);
  root.style.setProperty("--foreground", c.foreground);
  root.style.setProperty("--card", c.card);
  root.style.setProperty("--muted-foreground", c.muted);
  root.style.setProperty("--accent", c.accent);

  // Store active theme ID
  try { localStorage.setItem("jarvis-active-theme", theme.id); } catch { /* ignore */ }
}

export function getActiveThemeId(): string {
  try { return localStorage.getItem("jarvis-active-theme") || "classic-cyan"; } catch { return "classic-cyan"; }
}