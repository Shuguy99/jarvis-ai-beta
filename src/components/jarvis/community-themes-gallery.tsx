import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Palette, Download, Upload, Trash2, Check, Sparkles } from "lucide-react";
import {
  getAllThemes, saveCustomTheme, deleteCustomTheme,
  exportTheme, importTheme, applyThemeToCSS, getActiveThemeId,
  BUILTIN_THEMES, type ThemePreset,
} from "@/lib/community-themes";
import { playSound } from "@/lib/sounds";

export function CommunityThemesGallery() {
  const [themes, setThemes] = useState<ThemePreset[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    setThemes(getAllThemes());
    setActiveId(getActiveThemeId());
  }, []);

  function applyTheme(theme: ThemePreset) {
    playSound("success");
    applyThemeToCSS(theme);
    setActiveId(theme.id);
  }

  function handleExport(theme: ThemePreset) {
    playSound("click");
    const json = exportTheme(theme);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-theme-${theme.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = importTheme(reader.result as string);
        if (result) {
          playSound("success");
          setThemes(getAllThemes());
          setImportError(null);
        } else {
          setImportError("Невалидный формат темы");
          playSound("error");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleDelete(id: string) {
    if (BUILTIN_THEMES.some(t => t.id === id)) return;
    playSound("deactivate");
    deleteCustomTheme(id);
    setThemes(getAllThemes());
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-primary anim-pulse-glow" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary">Themes</span>
        </div>
        <div className="flex gap-1">
          <button onClick={handleImport} className="flex items-center gap-1 rounded border border-primary/20 px-2 py-0.5 font-mono text-[9px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition">
            <Upload className="h-3 w-3" />
            Импорт
          </button>
        </div>
      </div>

      {importError && (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-2 py-1 font-mono text-[9px] text-destructive">
          {importError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto jarvis-scroll">
        {themes.map(theme => (
          <div
            key={theme.id}
            className={`group relative rounded-lg border p-2 cursor-pointer transition ${
              theme.id === activeId
                ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                : "border-primary/10 bg-card/30 hover:border-primary/30 hover:bg-card/50"
            }`}
            onClick={() => applyTheme(theme)}
          >
            {/* Color preview */}
            <div className="mb-2 flex gap-1">
              {Object.values(theme.colors).slice(0, 5).map((color, i) => (
                <div
                  key={i}
                  className="h-4 flex-1 rounded-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="font-mono text-[10px] text-foreground truncate">{theme.name}</div>
            <div className="font-mono text-[8px] text-muted-foreground truncate">{theme.author}</div>

            {/* Active indicator */}
            {theme.id === activeId && (
              <div className="absolute top-1 right-1">
                <Check className="h-3 w-3 text-primary" />
              </div>
            )}

            {/* Actions on hover */}
            <div className="absolute bottom-1 right-1 hidden group-hover:flex gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); handleExport(theme); }}
                className="rounded p-0.5 text-muted-foreground hover:text-primary transition"
              >
                <Download className="h-2.5 w-2.5" />
              </button>
              {!BUILTIN_THEMES.some(t => t.id === theme.id) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(theme.id); }}
                  className="rounded p-0.5 text-muted-foreground hover:text-destructive transition"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}