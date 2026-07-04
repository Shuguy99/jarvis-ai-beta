"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { playSound } from "@/lib/sounds";
import {
  type ThemeDefinition,
  type ThemeColors,
  getCustomThemes,
  saveCustomTheme,
  deleteCustomTheme,
  applyTheme,
  exportThemeCSS,
  generateCustomThemeId,
  getBuiltinThemes,
} from "@/lib/theme-engine";
import {
  Save,
  Trash2,
  Download,
  Plus,
  Palette,
  Eye,
  Copy,
  Check,
} from "lucide-react";

// ── Props ─────────────────────────────────────────────────────

interface ThemeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThemeApplied?: (theme: ThemeDefinition) => void;
}

// ── Color field definitions ───────────────────────────────────

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "Main accent color (oklch)" },
  { key: "primaryRgb", label: "Primary RGB", hint: 'e.g. "0, 255, 255" for opacity variants' },
  { key: "background", label: "Background", hint: "Page background" },
  { key: "foreground", label: "Foreground", hint: "Main text color" },
  { key: "card", label: "Card", hint: "Card/panel background" },
  { key: "border", label: "Border", hint: "Border color" },
  { key: "muted", label: "Muted Text", hint: "Muted / secondary text" },
  { key: "accent", label: "Accent", hint: "Secondary accent" },
];

// ── Default colors (Mark 1 based) ─────────────────────────────

const DEFAULT_COLORS: ThemeColors = {
  primary: "oklch(0.85 0.19 193)",
  primaryRgb: "0, 230, 235",
  background: "oklch(0.08 0.03 250)",
  foreground: "oklch(0.94 0.04 190)",
  card: "oklch(0.11 0.03 240)",
  border: "oklch(0.85 0.19 193 / 16%)",
  muted: "oklch(0.68 0.05 195)",
  accent: "oklch(0.3 0.08 190)",
};

// ── Component ─────────────────────────────────────────────────

export function ThemeEditor({ open, onOpenChange, onThemeApplied }: ThemeEditorProps) {
  const [name, setName] = useState("");
  const [colors, setColors] = useState<ThemeColors>({ ...DEFAULT_COLORS });
  const [customThemes, setCustomThemes] = useState<ThemeDefinition[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cssOutput, setCssOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Refresh custom themes list from localStorage
  const refreshThemes = useCallback(() => {
    setCustomThemes(getCustomThemes());
  }, []);

  useEffect(() => {
    if (open) refreshThemes();
  }, [open, refreshThemes]);

  // Reset form
  const resetForm = useCallback(() => {
    setName("");
    setColors({ ...DEFAULT_COLORS });
    setEditingId(null);
    setCssOutput("");
    setPreviewing(false);
  }, []);

  // Preview theme in real-time
  const handlePreview = useCallback(() => {
    const theme: ThemeDefinition = {
      id: editingId ?? generateCustomThemeId(name || "untitled"),
      name: name || "Untitled Theme",
      isBuiltin: false,
      colors,
    };
    applyTheme(theme);
    setPreviewing(true);
    onThemeApplied?.(theme);
    playSound("click");
  }, [colors, editingId, name, onThemeApplied]);

  // Save theme
  const handleSave = useCallback(() => {
    const id = editingId ?? generateCustomThemeId(name || "untitled");
    const theme: ThemeDefinition = {
      id,
      name: name || "Untitled Theme",
      isBuiltin: false,
      colors,
    };
    saveCustomTheme(theme);
    applyTheme(theme);
    refreshThemes();
    onThemeApplied?.(theme);
    playSound("save");
    resetForm();
  }, [colors, editingId, name, onThemeApplied, refreshThemes, resetForm]);

  // Delete custom theme
  const handleDelete = useCallback(
    (id: string) => {
      deleteCustomTheme(id);
      refreshThemes();
      playSound("click");
      // If we were editing this theme, reset
      if (editingId === id) resetForm();
    },
    [editingId, refreshThemes, resetForm]
  );

  // Edit existing custom theme
  const handleEdit = useCallback((theme: ThemeDefinition) => {
    setName(theme.name);
    setColors({ ...theme.colors });
    setEditingId(theme.id);
    setCssOutput("");
    setPreviewing(false);
    playSound("click");
  }, []);

  // Export CSS
  const handleExport = useCallback(() => {
    const theme: ThemeDefinition = {
      id: editingId ?? generateCustomThemeId(name || "untitled"),
      name: name || "Untitled Theme",
      isBuiltin: false,
      colors,
    };
    const css = exportThemeCSS(theme);
    setCssOutput(css);
    playSound("data-received");
  }, [colors, editingId, name]);

  // Copy CSS to clipboard
  const handleCopyCSS = useCallback(async () => {
    if (!cssOutput) return;
    try {
      await navigator.clipboard.writeText(cssOutput);
      setCopied(true);
      playSound("success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard may be unavailable */
    }
  }, [cssOutput]);

  // Load a builtin theme as base for customization
  const handleUseBuiltinBase = useCallback((themeId: string) => {
    const builtin = getBuiltinThemes().find((t) => t.id === themeId);
    if (builtin) {
      setColors({ ...builtin.colors });
      playSound("click");
    }
  }, []);

  // Update a single color
  const updateColor = useCallback((key: keyof ThemeColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
    setPreviewing(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg bg-background/95 backdrop-blur-xl border-jarvis-border-cyan jarvis-box-glow font-mono text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-widest text-foreground jarvis-glow flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Theme Editor
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[10px] tracking-wide">
            Create and manage custom JARVIS themes
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-2">
          <div className="space-y-4 py-2">
            {/* ── Theme name ────────────────────── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Theme Name
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. MARK 85 — Purple"
                className="h-8 text-xs bg-card border-border font-mono"
                maxLength={40}
              />
            </div>

            {/* ── Base theme selector ──────────── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Start from Builtin
              </Label>
              <div className="flex gap-2">
                {getBuiltinThemes().map((bt) => (
                  <button
                    key={bt.id}
                    type="button"
                    onClick={() => handleUseBuiltinBase(bt.id)}
                    className="px-3 py-1.5 rounded text-[10px] uppercase tracking-wider border border-border hover:border-primary/50 transition-colors cursor-pointer"
                    title={`Use ${bt.name} colors as base`}
                  >
                    {bt.name}
                  </button>
                ))}
              </div>
            </div>

            <Separator className="bg-border/50" />

            {/* ── Color pickers ─────────────────── */}
            <div className="space-y-3">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Colors
              </Label>
              {COLOR_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded border border-border flex-shrink-0 overflow-hidden">
                    <input
                      type="color"
                      value={oklchToHex(colors[key])}
                      onChange={(e) => updateColor(key, e.target.value)}
                      className="w-full h-full cursor-pointer border-0 p-0"
                      title={`Pick ${label} color`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-widest text-foreground/80">
                      {label}
                    </div>
                    <div className="text-[9px] text-muted-foreground">{hint}</div>
                  </div>
                  <Input
                    value={colors[key]}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="w-48 h-7 text-[10px] font-mono bg-card border-border text-right"
                  />
                </div>
              ))}
            </div>

            <Separator className="bg-border/50" />

            {/* ── Action buttons ────────────────── */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreview}
                className="h-8 text-[10px] uppercase tracking-widest gap-1.5 border-border hover:border-primary/50"
              >
                <Eye className="h-3 w-3" />
                Preview
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!name.trim()}
                className="h-8 text-[10px] uppercase tracking-widest gap-1.5"
              >
                <Save className="h-3 w-3" />
                {editingId ? "Update" : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 text-[10px] uppercase tracking-widest gap-1.5 border-border hover:border-primary/50"
              >
                <Download className="h-3 w-3" />
                Export CSS
              </Button>
            </div>

            {/* ── CSS output ────────────────────── */}
            {cssOutput && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Generated CSS
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyCSS}
                    className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <Textarea
                  value={cssOutput}
                  readOnly
                  className="min-h-[140px] text-[10px] font-mono bg-card border-border resize-none"
                />
              </div>
            )}

            <Separator className="bg-border/50" />

            {/* ── Saved custom themes ───────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Saved Custom Themes
              </Label>
              {customThemes.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/60 italic">
                  No custom themes yet. Create one above.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto jarvis-scroll">
                  {customThemes.map((ct) => (
                    <div
                      key={ct.id}
                      className="flex items-center gap-3 rounded border border-border px-3 py-2 hover:border-primary/30 transition-colors"
                    >
                      {/* Color swatch */}
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: ct.colors.primary }}
                      />
                      {/* Name + id */}
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase tracking-wider text-foreground truncate">
                          {ct.name}
                        </div>
                        <div className="text-[9px] text-muted-foreground truncate">{ct.id}</div>
                      </div>
                      {/* Actions */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(ct)}
                          className="p-1 rounded hover:bg-accent/20 transition-colors cursor-pointer"
                          title="Edit theme"
                        >
                          <Palette className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            applyTheme(ct);
                            onThemeApplied?.(ct);
                            playSound("click");
                          }}
                          className="p-1 rounded hover:bg-accent/20 transition-colors cursor-pointer"
                          title="Apply theme"
                        >
                          <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ct.id)}
                          className="p-1 rounded hover:bg-destructive/20 transition-colors cursor-pointer"
                          title="Delete theme"
                        >
                          <Trash2 className="h-3 w-3 text-destructive/70" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Very rough oklch → hex for the color picker input.
 * The color picker only works with hex, so we do a best-effort conversion.
 * For proper oklch, users should type the value directly.
 */
function oklchToHex(color: string): string {
  // If it's already hex, return as-is
  if (color.startsWith("#")) return color.length === 7 ? color : "#00e6eb";
  // Default fallback: cyan for unknown oklch values
  return "#00e6eb";
}