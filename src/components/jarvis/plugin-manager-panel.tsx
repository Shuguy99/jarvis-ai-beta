/**
 * Plugin Manager Panel
 *
 * Full plugin management UI with three tabs:
 *  - Installed: list of loaded plugins with enable/disable, settings, unload
 *  - Marketplace: grid of built-in plugins available to install
 *  - Import/Export: import plugin from JSON, export selected plugin
 */

import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Puzzle,
  Download,
  Upload,
  Trash2,
  Settings,
  Plus,
  Power,
  Store,
  CloudSun,
  Terminal,
  Clock,
  Calculator,
  FileJson,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { playSound } from "@/lib/sounds";
import { usePlugins } from "@/hooks/use-plugins";
import type { PluginState, PluginSettingDef, PluginManifest } from "@/lib/types";

// ── Icon resolver ───────────────────────────────────────────────

function PluginIcon({
  name,
  className = "h-4 w-4",
}: {
  name?: string;
  className?: string;
}) {
  const cls = className;
  switch (name) {
    case "CloudSun":
      return <CloudSun className={cls} />;
    case "Terminal":
      return <Terminal className={cls} />;
    case "Clock":
      return <Clock className={cls} />;
    case "Calculator":
      return <Calculator className={cls} />;
    default:
      return <Puzzle className={cls} />;
  }
}

// ── Settings Modal ──────────────────────────────────────────────

function SettingsModal({
  plugin,
  settings,
  currentValues,
  onUpdate,
  onClose,
}: {
  plugin: PluginState;
  settings: PluginSettingDef[];
  currentValues: Record<string, unknown>;
  onUpdate: (key: string, value: unknown) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[360px] max-w-[90vw] rounded-xl border border-primary/20 bg-background/95 p-5 shadow-2xl backdrop-blur-md"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-primary">
              Settings
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            {plugin.manifest.name}
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {settings.map((def) => {
            const value = currentValues[def.key] ?? def.default;
            return (
              <div key={def.key} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 font-mono text-[10px] text-foreground/70">
                  {def.label}
                </span>
                {def.type === "boolean" && (
                  <Switch
                    checked={!!value}
                    onCheckedChange={(checked) => {
                      onUpdate(def.key, checked);
                      playSound("click");
                    }}
                    className="scale-75"
                  />
                )}
                {def.type === "select" && def.options && (
                  <select
                    value={String(value)}
                    onChange={(e) => {
                      onUpdate(def.key, e.target.value);
                      playSound("click");
                    }}
                    className="h-7 max-w-[120px] rounded-md border border-primary/15 bg-background/50 px-2 font-mono text-[10px] text-foreground/70 focus:border-primary/30 focus:outline-none"
                  >
                    {def.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
                {def.type === "number" && (
                  <input
                    type="number"
                    value={Number(value)}
                    onChange={(e) => {
                      onUpdate(def.key, Number(e.target.value));
                      playSound("click");
                    }}
                    className="h-7 w-20 rounded-md border border-primary/15 bg-background/50 px-2 font-mono text-[10px] text-foreground/70 text-right focus:border-primary/30 focus:outline-none"
                  />
                )}
                {def.type === "text" && (
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => {
                      onUpdate(def.key, e.target.value);
                    }}
                    className="h-7 w-36 rounded-md border border-primary/15 bg-background/50 px-2 font-mono text-[10px] text-foreground/70 focus:border-primary/30 focus:outline-none"
                  />
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => {
            playSound("click");
            onClose();
          }}
          className="mt-5 w-full rounded-md border border-primary/20 bg-primary/5 py-2 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/10"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Installed Tab ───────────────────────────────────────────────

function InstalledTab() {
  const { plugins, setEnabled, unloadPlugin, getSettings, updateSetting, getSetting } =
    usePlugins();
  const [settingsPluginId, setSettingsPluginId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...plugins].sort((a, b) => a.manifest.name.localeCompare(b.manifest.name)),
    [plugins],
  );

  const settingsPlugin = settingsPluginId
    ? plugins.find((p) => p.manifest.id === settingsPluginId)
    : null;
  const settingsDefs = settingsPluginId ? getSettings(settingsPluginId) : [];
  const settingsValues = useMemo(() => {
    if (!settingsPlugin) return {};
    return { ...settingsPlugin.settings };
  }, [settingsPlugin]);

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      setEnabled(id, enabled);
      playSound(enabled ? "activate" : "deactivate", 0.4);
    },
    [setEnabled],
  );

  const handleUnload = useCallback(
    (id: string) => {
      unloadPlugin(id);
      playSound("deactivate", 0.5);
    },
    [unloadPlugin],
  );

  return (
    <>
      {sorted.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center gap-2">
          <Puzzle className="h-8 w-8 text-muted-foreground/15" />
          <span className="font-mono text-xs text-muted-foreground/30">
            No plugins installed
          </span>
          <span className="font-mono text-[9px] text-muted-foreground/20">
            Visit the Marketplace tab to browse plugins
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {sorted.map((plugin) => {
            const m = plugin.manifest;
            const toolCount = m.tools?.length ?? 0;
            const panelCount = m.panels?.length ?? 0;
            return (
              <motion.div
                key={m.id}
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
                  {/* Top row */}
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border ${
                        plugin.enabled
                          ? "border-primary/20 bg-primary/5"
                          : "border-border/20 bg-background/30"
                      }`}
                    >
                      <PluginIcon
                        name={m.icon}
                        className={`h-4 w-4 ${plugin.enabled ? "text-primary" : "text-muted-foreground/40"}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-semibold ${
                            plugin.enabled ? "text-foreground/90" : "text-muted-foreground/50"
                          }`}
                        >
                          {m.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="h-4 border-primary/20 bg-primary/5 px-1.5 font-mono text-[8px] text-primary/60"
                        >
                          v{m.version}
                        </Badge>
                        <Badge
                          variant={plugin.enabled ? "default" : "secondary"}
                          className="h-4 px-1.5 font-mono text-[8px]"
                        >
                          {plugin.enabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p
                        className={`mt-0.5 line-clamp-2 font-mono text-[10px] leading-relaxed ${
                          plugin.enabled ? "text-muted-foreground/60" : "text-muted-foreground/30"
                        }`}
                      >
                        {m.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-[8px] text-muted-foreground/30">
                          {m.author}
                        </span>
                        {toolCount > 0 && (
                          <span className="font-mono text-[8px] text-cyan-400/40">
                            {toolCount} tool{toolCount > 1 ? "s" : ""}
                          </span>
                        )}
                        {panelCount > 0 && (
                          <span className="font-mono text-[8px] text-cyan-400/40">
                            {panelCount} panel{panelCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <Switch
                      checked={plugin.enabled}
                      onCheckedChange={(checked) => handleToggle(m.id, checked)}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="mt-2.5 flex items-center gap-1.5">
                    {settingsDefs.length > 0 && settingsPluginId === m.id ? (
                      <></>
                    ) : (
                      getSettings(m.id).length > 0 && (
                        <button
                          onClick={() => {
                            setSettingsPluginId(m.id);
                            playSound("click");
                          }}
                          className="flex items-center gap-1 rounded-md border border-border/30 bg-background/30 px-2 py-1 font-mono text-[9px] text-muted-foreground/50 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                        >
                          <Settings className="h-3 w-3" />
                          Settings
                        </button>
                      )
                    )}
                    <button
                      onClick={() => handleUnload(m.id)}
                      className="flex items-center gap-1 rounded-md border border-border/30 bg-background/30 px-2 py-1 font-mono text-[9px] text-muted-foreground/50 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                    >
                      <Trash2 className="h-3 w-3" />
                      Unload
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Settings modal */}
      <AnimatePresence>
        {settingsPlugin && settingsDefs.length > 0 && (
          <SettingsModal
            plugin={settingsPlugin}
            settings={settingsDefs}
            currentValues={settingsValues}
            onUpdate={(key, value) => {
              updateSetting(settingsPlugin.manifest.id, key, value);
            }}
            onClose={() => {
              setSettingsPluginId(null);
              playSound("deactivate", 0.3);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Marketplace Tab ─────────────────────────────────────────────

function MarketplaceTab() {
  const { builtinPlugins, plugins, loadPlugin } = usePlugins();

  const installedIds = useMemo(
    () => new Set(plugins.map((p) => p.manifest.id)),
    [plugins],
  );

  const available = useMemo(
    () => builtinPlugins.filter((b) => !installedIds.has(b.id)),
    [builtinPlugins, installedIds],
  );

  const handleInstall = useCallback(
    (manifest: PluginManifest) => {
      loadPlugin(manifest);
      playSound("activate", 0.5);
    },
    [loadPlugin],
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Store className="h-3.5 w-3.5 text-primary/60" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
          Built-in Plugins
        </span>
      </div>

      {available.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2">
          <CheckCircle className="h-6 w-6 text-primary/30" />
          <span className="font-mono text-xs text-muted-foreground/30">
            All built-in plugins are installed
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {available.map((manifest) => (
            <motion.div
              key={manifest.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg border border-border/20 bg-card/30 backdrop-blur-sm transition-colors hover:border-primary/20 hover:bg-card/50"
            >
              <div className="p-3">
                <div className="flex items-start gap-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/5">
                    <PluginIcon name={manifest.icon} className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground/90">
                        {manifest.name}
                      </span>
                      <Badge
                        variant="outline"
                        className="h-4 border-primary/20 bg-primary/5 px-1.5 font-mono text-[8px] text-primary/60"
                      >
                        v{manifest.version}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 font-mono text-[10px] leading-relaxed text-muted-foreground/60">
                      {manifest.description}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-[8px] text-muted-foreground/30">
                        {manifest.author}
                      </span>
                      {manifest.tools && manifest.tools.length > 0 && (
                        <span className="font-mono text-[8px] text-cyan-400/40">
                          {manifest.tools.length} tool{manifest.tools.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5">
                  <button
                    onClick={() => handleInstall(manifest)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 py-1.5 font-mono text-[9px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/15"
                  >
                    <Plus className="h-3 w-3" />
                    Install
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// Placeholder check circle icon (inline)
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

// ── Import/Export Tab ───────────────────────────────────────────

function ImportExportTab() {
  const { plugins, exportPlugin, importPlugin } = usePlugins();
  const [error, setError] = useState<string | null>(null);
  const [exportedId, setExportedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          importPlugin(reader.result as string);
          playSound("activate", 0.5);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to import plugin");
        }
      };
      reader.readAsText(file);
      // Reset so the same file can be re-imported
      e.target.value = "";
    },
    [importPlugin],
  );

  const handleExport = useCallback(
    (id: string) => {
      try {
        const json = exportPlugin(id);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `plugin-${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setExportedId(id);
        playSound("activate", 0.3);
        setTimeout(() => setExportedId(null), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      }
    },
    [exportPlugin],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Import */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Upload className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
            Import Plugin
          </span>
        </div>
        <p className="mb-2 font-mono text-[9px] text-muted-foreground/40">
          Upload a plugin JSON manifest to install it.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
          aria-label="Import plugin JSON file"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 py-2.5 font-mono text-[10px] uppercase tracking-widest text-primary transition-colors hover:bg-primary/15"
        >
          <Upload className="h-3.5 w-3.5" />
          Select JSON File
        </button>
      </div>

      {/* Export */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary/60">
            Export Plugin
          </span>
        </div>
        <p className="mb-2 font-mono text-[9px] text-muted-foreground/40">
          Export an installed plugin as a JSON file.
        </p>
        {plugins.length === 0 ? (
          <span className="font-mono text-[10px] text-muted-foreground/30">
            No plugins to export.
          </span>
        ) : (
          <div className="flex flex-col gap-1.5">
            {plugins.map((plugin) => (
              <button
                key={plugin.manifest.id}
                onClick={() => handleExport(plugin.manifest.id)}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[9px] transition-colors ${
                  exportedId === plugin.manifest.id
                    ? "border-green-500/30 bg-green-500/10 text-green-400"
                    : "border-border/30 bg-background/30 text-muted-foreground/50 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <PluginIcon
                  name={plugin.manifest.icon}
                  className="h-3.5 w-3.5 flex-shrink-0"
                />
                <span className="flex-1 text-left">{plugin.manifest.name}</span>
                <FileJson className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 rounded-md border border-rose-500/20 bg-rose-500/5 p-3"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-400" />
            <span className="font-mono text-[10px] text-rose-300/80">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────

type TabId = "installed" | "marketplace" | "import-export";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "installed", label: "Installed", icon: Power },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "import-export", label: "Import/Export", icon: FileJson },
];

export function PluginManagerPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("installed");

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/10 px-1 pb-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                playSound("click");
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 font-mono text-[10px] transition-all ${
                isActive
                  ? "border-primary/30 bg-primary/10 text-primary shadow-[0_0_12px_oklch(0.85_0.19_193/15%)]"
                  : "border-transparent text-muted-foreground/50 hover:border-border/20 hover:bg-background/30 hover:text-foreground/60"
              }`}
            >
              <TabIcon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 jarvis-scroll">
        <AnimatePresence mode="wait">
          {activeTab === "installed" && (
            <motion.div
              key="installed"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              <InstalledTab />
            </motion.div>
          )}
          {activeTab === "marketplace" && (
            <motion.div
              key="marketplace"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              <MarketplaceTab />
            </motion.div>
          )}
          {activeTab === "import-export" && (
            <motion.div
              key="import-export"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              <ImportExportTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-border/10 px-4 py-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[8px] text-muted-foreground/25">
            PLUGIN SYSTEM v2.0
          </span>
          <span className="font-mono text-[8px] text-muted-foreground/25">
            SANDBOX ENABLED
          </span>
        </div>
      </div>
    </div>
  );
}