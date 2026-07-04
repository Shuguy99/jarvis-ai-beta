import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getBuiltinThemes,
  getCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
  getAllThemes,
  applyTheme,
  exportThemeCSS,
  generateCustomThemeId,
  type ThemeDefinition,
} from "@/lib/theme-engine";

// ── Mock localStorage ─────────────────────────────────────────

const storage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => storage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
  removeItem: vi.fn((key: string) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach((k) => delete storage[k]); }),
  get length() { return Object.keys(storage).length; },
  key: vi.fn((i: number) => Object.keys(storage)[i] ?? null),
};

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
  localStorageMock.clear();
  vi.clearAllMocks();
  // Reset any inline styles on documentElement
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("style");
});

// ── getBuiltinThemes ───────────────────────────────────────────

describe("getBuiltinThemes", () => {
  it("returns exactly 3 themes", () => {
    const themes = getBuiltinThemes();
    expect(themes).toHaveLength(3);
  });

  it("each theme has required fields", () => {
    const themes = getBuiltinThemes();
    for (const t of themes) {
      expect(t.id).toBeDefined();
      expect(t.name).toBeDefined();
      expect(t.isBuiltin).toBe(true);
      expect(t.colors).toBeDefined();
      expect(t.colors.primary).toMatch(/oklch/);
      expect(t.colors.primaryRgb).toMatch(/\d/);
      expect(t.colors.background).toMatch(/oklch/);
      expect(t.colors.foreground).toMatch(/oklch/);
      expect(t.colors.card).toMatch(/oklch/);
      expect(t.colors.border).toMatch(/oklch/);
      expect(t.colors.muted).toMatch(/oklch/);
      expect(t.colors.accent).toMatch(/oklch/);
    }
  });

  it("returns mark1, mark42, mark50 ids", () => {
    const ids = getBuiltinThemes().map((t) => t.id);
    expect(ids).toContain("mark1");
    expect(ids).toContain("mark42");
    expect(ids).toContain("mark50");
  });

  it("returns copies (not frozen references)", () => {
    const a = getBuiltinThemes();
    const b = getBuiltinThemes();
    a[0].name = "MUTATED";
    expect(b[0].name).toBe("MARK 1");
  });
});

// ── getCustomThemes ───────────────────────────────────────────

describe("getCustomThemes", () => {
  it("returns empty array when nothing stored", () => {
    expect(getCustomThemes()).toEqual([]);
  });

  it("ignores invalid JSON in storage", () => {
    storage["jarvis-custom-themes"] = "not json";
    expect(getCustomThemes()).toEqual([]);
  });

  it("ignores non-array values", () => {
    storage["jarvis-custom-themes"] = JSON.stringify({ id: "x" });
    expect(getCustomThemes()).toEqual([]);
  });

  it("filters out invalid theme objects", () => {
    storage["jarvis-custom-themes"] = JSON.stringify([
      { id: "valid", name: "Valid", isBuiltin: false, colors: { primary: "#fff", primaryRgb: "255,255,255", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" } },
      { id: "invalid" }, // missing fields
      null,
      "string",
    ]);
    const result = getCustomThemes();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("valid");
  });
});

// ── saveCustomTheme + getCustomThemes round-trip ──────────────

describe("saveCustomTheme / getCustomThemes round-trip", () => {
  it("saves and retrieves a custom theme", () => {
    const theme: ThemeDefinition = {
      id: "custom-test",
      name: "Test Theme",
      isBuiltin: false,
      colors: {
        primary: "oklch(0.7 0.2 300)",
        primaryRgb: "180, 60, 255",
        background: "oklch(0.1 0.02 280)",
        foreground: "oklch(0.9 0.03 300)",
        card: "oklch(0.13 0.02 280)",
        border: "oklch(0.7 0.2 300 / 16%)",
        muted: "oklch(0.6 0.04 300)",
        accent: "oklch(0.4 0.1 300)",
      },
    };

    saveCustomTheme(theme);
    const retrieved = getCustomThemes();
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe("custom-test");
    expect(retrieved[0].name).toBe("Test Theme");
    expect(retrieved[0].isBuiltin).toBe(false);
    expect(retrieved[0].colors.primary).toBe("oklch(0.7 0.2 300)");
  });

  it("forces isBuiltin to false on save", () => {
    const theme: ThemeDefinition = {
      id: "custom-force",
      name: "Force",
      isBuiltin: true, // try to save as builtin
      colors: {
        primary: "#ff0000", primaryRgb: "255,0,0", background: "#000",
        foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa",
      },
    };
    saveCustomTheme(theme);
    const retrieved = getCustomThemes();
    expect(retrieved[0].isBuiltin).toBe(false);
  });

  it("upserts by id (update existing)", () => {
    const theme1: ThemeDefinition = {
      id: "custom-upsert", name: "Original", isBuiltin: false,
      colors: { primary: "#ff0000", primaryRgb: "255,0,0", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" },
    };
    const theme2: ThemeDefinition = {
      id: "custom-upsert", name: "Updated", isBuiltin: false,
      colors: { primary: "#00ff00", primaryRgb: "0,255,0", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" },
    };

    saveCustomTheme(theme1);
    saveCustomTheme(theme2);
    const retrieved = getCustomThemes();
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].name).toBe("Updated");
    expect(retrieved[0].colors.primary).toBe("#00ff00");
  });
});

// ── deleteCustomTheme ─────────────────────────────────────────

describe("deleteCustomTheme", () => {
  it("removes a theme by id", () => {
    const themes: ThemeDefinition[] = [
      { id: "keep", name: "Keep", isBuiltin: false, colors: { primary: "#f00", primaryRgb: "255,0,0", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" } },
      { id: "delete-me", name: "Delete", isBuiltin: false, colors: { primary: "#0f0", primaryRgb: "0,255,0", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" } },
    ];
    saveCustomTheme(themes[0]);
    saveCustomTheme(themes[1]);
    expect(getCustomThemes()).toHaveLength(2);

    deleteCustomTheme("delete-me");
    const remaining = getCustomThemes();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("keep");
  });

  it("does nothing for non-existent id", () => {
    const theme: ThemeDefinition = {
      id: "existing", name: "E", isBuiltin: false,
      colors: { primary: "#f00", primaryRgb: "255,0,0", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" },
    };
    saveCustomTheme(theme);
    deleteCustomTheme("nonexistent");
    expect(getCustomThemes()).toHaveLength(1);
  });
});

// ── getAllThemes ───────────────────────────────────────────────

describe("getAllThemes", () => {
  it("returns builtins + customs combined", () => {
    const custom: ThemeDefinition = {
      id: "custom-all", name: "Custom", isBuiltin: false,
      colors: { primary: "#f00", primaryRgb: "255,0,0", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" },
    };
    saveCustomTheme(custom);

    const all = getAllThemes();
    expect(all).toHaveLength(4); // 3 builtins + 1 custom
    expect(all[0].isBuiltin).toBe(true);
    expect(all[3].isBuiltin).toBe(false);
    expect(all[3].id).toBe("custom-all");
  });

  it("returns only builtins when no customs", () => {
    const all = getAllThemes();
    expect(all).toHaveLength(3);
    expect(all.every((t) => t.isBuiltin)).toBe(true);
  });
});

// ── applyTheme ────────────────────────────────────────────────

describe("applyTheme", () => {
  it("sets data-theme attribute for builtin themes", () => {
    const mark42 = getBuiltinThemes().find((t) => t.id === "mark42")!;
    applyTheme(mark42);
    expect(document.documentElement.getAttribute("data-theme")).toBe("mark42");
  });

  it("sets data-theme attribute for mark1", () => {
    const mark1 = getBuiltinThemes().find((t) => t.id === "mark1")!;
    applyTheme(mark1);
    expect(document.documentElement.getAttribute("data-theme")).toBe("mark1");
  });

  it("removes data-theme and sets CSS vars for custom themes", () => {
    const custom: ThemeDefinition = {
      id: "custom-apply", name: "Apply Test", isBuiltin: false,
      colors: {
        primary: "#ff00ff", primaryRgb: "255,0,255", background: "#0a0a0a",
        foreground: "#eeeeee", card: "#1a1a1a", border: "#333333",
        muted: "#888888", accent: "#cc00cc",
      },
    };
    applyTheme(custom);

    expect(document.documentElement.getAttribute("data-theme")).toBeNull();
    expect(document.documentElement.style.getPropertyValue("--primary")).toBe("#ff00ff");
    expect(document.documentElement.style.getPropertyValue("--ring")).toBe("#ff00ff");
    expect(document.documentElement.style.getPropertyValue("--border")).toBe("#333333");
    expect(document.documentElement.style.getPropertyValue("--background")).toBe("#0a0a0a");
    expect(document.documentElement.style.getPropertyValue("--foreground")).toBe("#eeeeee");
    expect(document.documentElement.style.getPropertyValue("--card")).toBe("#1a1a1a");
    expect(document.documentElement.style.getPropertyValue("--jarvis-primary")).toBe("#ff00ff");
  });
});

// ── exportThemeCSS ────────────────────────────────────────────

describe("exportThemeCSS", () => {
  it("generates valid CSS with correct selector", () => {
    const theme = getBuiltinThemes()[0];
    const css = exportThemeCSS(theme);
    expect(css).toContain('[data-theme="mark1"]');
    expect(css).toContain("--primary:");
    expect(css).toContain("--background:");
  });

  it("includes theme name as comment", () => {
    const theme: ThemeDefinition = {
      id: "custom-css", name: "My Purple", isBuiltin: false,
      colors: { primary: "#aa00ff", primaryRgb: "170,0,255", background: "#000", foreground: "#fff", card: "#111", border: "#333", muted: "#999", accent: "#aaa" },
    };
    const css = exportThemeCSS(theme);
    expect(css).toContain("My Purple");
  });

  it("contains all required CSS variables", () => {
    const theme = getBuiltinThemes()[1];
    const css = exportThemeCSS(theme);
    const requiredVars = [
      "--primary", "--ring", "--border", "--input", "--chart-1",
      "--sidebar-primary", "--sidebar-border", "--sidebar-ring",
      "--background", "--foreground", "--card", "--card-foreground",
      "--popover", "--popover-foreground", "--muted-foreground",
      "--accent", "--accent-foreground", "--jarvis-primary", "--jarvis-primary-glow",
    ];
    for (const v of requiredVars) {
      expect(css).toContain(v);
    }
  });

  it("outputs valid CSS structure with braces", () => {
    const css = exportThemeCSS(getBuiltinThemes()[0]);
    expect(css.trim()).toMatch(/\{[\s\S]*\}/);
  });
});

// ── generateCustomThemeId ─────────────────────────────────────

describe("generateCustomThemeId", () => {
  it("starts with 'custom-'", () => {
    const id = generateCustomThemeId("Test Theme");
    expect(id).toMatch(/^custom-/);
  });

  it("contains a slug of the name", () => {
    const id = generateCustomThemeId("Purple Rain");
    expect(id).toContain("purple-rain");
  });

  it("always generates unique ids", () => {
    vi.useFakeTimers();
    const a = generateCustomThemeId("Same");
    vi.advanceTimersByTime(1);
    const b = generateCustomThemeId("Same");
    vi.useRealTimers();
    expect(a).not.toBe(b);
  });
});