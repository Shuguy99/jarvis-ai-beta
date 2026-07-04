/**
 * JARVIS Theme Engine — Manages built-in and custom themes.
 *
 * Built-in themes (Mark 1 / 42 / 50) use oklch() colors and are applied via
 * CSS `[data-theme]` selectors in globals.css. Custom themes are stored in
 * localStorage and applied by setting CSS variables directly on :root.
 */

// ── Theme definition ──────────────────────────────────────────

export interface ThemeColors {
  primary: string;       // main accent color (oklch)
  primaryRgb: string;    // for opacity variants e.g. "0, 255, 255"
  background: string;    // page background
  foreground: string;    // main text
  card: string;          // card/panel background
  border: string;        // border color
  muted: string;         // muted text
  accent: string;        // secondary accent
}

export interface ThemeDefinition {
  id: string;            // unique id e.g. "mark-1", "custom-mytheme"
  name: string;          // display name
  isBuiltin: boolean;    // true for Mark 1/42/50
  colors: ThemeColors;
}

// ── Storage key ───────────────────────────────────────────────

const CUSTOM_THEMES_KEY = "jarvis-custom-themes";

// ── Built-in theme definitions ────────────────────────────────
// Colors extracted from globals.css :root / [data-theme="mark42"] / [data-theme="mark50"]

const BUILTIN_THEMES: readonly ThemeDefinition[] = [
  {
    id: "mark1",
    name: "MARK 1",
    isBuiltin: true,
    colors: {
      primary: "oklch(0.85 0.19 193)",
      primaryRgb: "0, 230, 235",
      background: "oklch(0.08 0.03 250)",
      foreground: "oklch(0.94 0.04 190)",
      card: "oklch(0.11 0.03 240)",
      border: "oklch(0.85 0.19 193 / 16%)",
      muted: "oklch(0.68 0.05 195)",
      accent: "oklch(0.3 0.08 190)",
    },
  },
  {
    id: "mark42",
    name: "MARK 42",
    isBuiltin: true,
    colors: {
      primary: "oklch(0.85 0.18 85)",
      primaryRgb: "255, 200, 60",
      background: "oklch(0.08 0.03 250)",
      foreground: "oklch(0.94 0.04 190)",
      card: "oklch(0.11 0.03 240)",
      border: "oklch(0.85 0.18 85 / 16%)",
      muted: "oklch(0.68 0.05 195)",
      accent: "oklch(0.3 0.08 190)",
    },
  },
  {
    id: "mark50",
    name: "MARK 50",
    isBuiltin: true,
    colors: {
      primary: "oklch(0.75 0.22 25)",
      primaryRgb: "255, 90, 50",
      background: "oklch(0.08 0.03 250)",
      foreground: "oklch(0.94 0.04 190)",
      card: "oklch(0.11 0.03 240)",
      border: "oklch(0.75 0.22 25 / 16%)",
      muted: "oklch(0.68 0.05 195)",
      accent: "oklch(0.3 0.08 190)",
    },
  },
] as const;

// ── Public API ────────────────────────────────────────────────

/** Returns the 3 built-in theme definitions (Mark 1, 42, 50) */
export function getBuiltinThemes(): ThemeDefinition[] {
  return BUILTIN_THEMES.map((t) => ({ ...t, colors: { ...t.colors } }));
}

/** Reads custom themes from localStorage */
export function getCustomThemes(): ThemeDefinition[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidThemeDefinition);
  } catch {
    return [];
  }
}

/** Saves a custom theme to localStorage (upserts by id) */
export function saveCustomTheme(theme: ThemeDefinition): void {
  if (typeof window === "undefined") return;
  const existing = getCustomThemes();
  const idx = existing.findIndex((t) => t.id === theme.id);
  const toSave: ThemeDefinition = { ...theme, isBuiltin: false };
  if (idx >= 0) {
    existing[idx] = toSave;
  } else {
    existing.push(toSave);
  }
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(existing));
}

/** Removes a custom theme from localStorage */
export function deleteCustomTheme(id: string): void {
  if (typeof window === "undefined") return;
  const existing = getCustomThemes();
  const filtered = existing.filter((t) => t.id !== id);
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(filtered));
}

/** Returns all themes: builtins first, then customs */
export function getAllThemes(): ThemeDefinition[] {
  return [...getBuiltinThemes(), ...getCustomThemes()];
}

/**
 * Applies a theme's colors as CSS variables on `document.documentElement`.
 * For built-in themes this sets `data-theme` attribute.
 * For custom themes this sets inline CSS variables on :root.
 */
export function applyTheme(theme: ThemeDefinition): void {
  if (typeof document === "undefined") return;

  if (theme.isBuiltin) {
    // Built-in: just set the data-theme attribute; CSS handles the rest
    document.documentElement.setAttribute("data-theme", theme.id);
  } else {
    // Custom: remove data-theme so CSS selectors don't override, set vars directly
    document.documentElement.removeAttribute("data-theme");
    const el = document.documentElement;
    const c = theme.colors;
    el.style.setProperty("--primary", c.primary);
    el.style.setProperty("--ring", c.primary);
    el.style.setProperty("--border", c.border);
    el.style.setProperty("--input", c.border);
    el.style.setProperty("--chart-1", c.primary);
    el.style.setProperty("--sidebar-primary", c.primary);
    el.style.setProperty("--sidebar-border", c.border);
    el.style.setProperty("--sidebar-ring", c.primary);
    el.style.setProperty("--background", c.background);
    el.style.setProperty("--foreground", c.foreground);
    el.style.setProperty("--card", c.card);
    el.style.setProperty("--card-foreground", c.foreground);
    el.style.setProperty("--popover", c.card);
    el.style.setProperty("--popover-foreground", c.foreground);
    el.style.setProperty("--muted-foreground", c.muted);
    el.style.setProperty("--accent", c.accent);
    el.style.setProperty("--accent-foreground", c.foreground);
    el.style.setProperty("--jarvis-primary", c.primary);
    el.style.setProperty("--jarvis-primary-glow", c.primary.replace(")", " / 50%)").replace("oklch(", "oklch("));
  }
}

/**
 * Generates a CSS string for a theme definition.
 * Useful for exporting / sharing custom themes.
 */
export function exportThemeCSS(theme: ThemeDefinition): string {
  const selector = theme.isBuiltin
    ? `[data-theme="${theme.id}"]`
    : `[data-theme="${theme.id}"]`;
  const c = theme.colors;

  const vars = [
    `  --primary: ${c.primary};`,
    `  --ring: ${c.primary};`,
    `  --border: ${c.border};`,
    `  --input: ${c.border};`,
    `  --chart-1: ${c.primary};`,
    `  --sidebar-primary: ${c.primary};`,
    `  --sidebar-border: ${c.border};`,
    `  --sidebar-ring: ${c.primary};`,
    `  --background: ${c.background};`,
    `  --foreground: ${c.foreground};`,
    `  --card: ${c.card};`,
    `  --card-foreground: ${c.foreground};`,
    `  --popover: ${c.card};`,
    `  --popover-foreground: ${c.foreground};`,
    `  --muted-foreground: ${c.muted};`,
    `  --accent: ${c.accent};`,
    `  --accent-foreground: ${c.foreground};`,
    `  --jarvis-primary: ${c.primary};`,
    `  --jarvis-primary-glow: ${c.primary.replace(")", " / 50%)")};`,
  ].join("\n");

  return `/* JARVIS Theme: ${theme.name} */\n${selector} {\n${vars}\n}\n`;
}

/** Generates a unique id for a new custom theme */
export function generateCustomThemeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `custom-${slug}-${Date.now().toString(36)}`;
}

// ── Helpers ───────────────────────────────────────────────────

function isValidThemeDefinition(obj: unknown): obj is ThemeDefinition {
  if (typeof obj !== "object" || obj === null) return false;
  const t = obj as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.isBuiltin === "boolean" &&
    typeof t.colors === "object" &&
    t.colors !== null &&
    typeof (t.colors as Record<string, unknown>).primary === "string" &&
    typeof (t.colors as Record<string, unknown>).primaryRgb === "string" &&
    typeof (t.colors as Record<string, unknown>).background === "string" &&
    typeof (t.colors as Record<string, unknown>).foreground === "string" &&
    typeof (t.colors as Record<string, unknown>).card === "string" &&
    typeof (t.colors as Record<string, unknown>).border === "string" &&
    typeof (t.colors as Record<string, unknown>).muted === "string" &&
    typeof (t.colors as Record<string, unknown>).accent === "string"
  );
}