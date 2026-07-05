/**
 * React hook for the JARVIS Plugin System.
 * Provides reactive state that updates when the PluginManager fires events.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { getPluginManager } from "@/lib/plugin-system";
import type {
  PluginState,
  PluginToolDef,
  PluginPanelDef,
  PluginSettingDef,
  PluginManifest,
} from "@/lib/types";

export interface UsePluginsReturn {
  /** All loaded plugins */
  plugins: PluginState[];
  /** Load / register a plugin */
  loadPlugin: (manifest: PluginManifest, code?: string) => void;
  /** Unload / remove a plugin */
  unloadPlugin: (id: string) => void;
  /** Toggle plugin enabled/disabled */
  setEnabled: (id: string, enabled: boolean) => void;
  /** Execute a plugin tool handler */
  executeTool: (pluginId: string, toolName: string, params: unknown) => Promise<unknown>;
  /** Get aggregated tools from all enabled plugins */
  tools: PluginToolDef[];
  /** Get aggregated panels from all enabled plugins */
  panels: PluginPanelDef[];
  /** Get settings definitions for a plugin */
  getSettings: (pluginId: string) => PluginSettingDef[];
  /** Update a plugin setting */
  updateSetting: (pluginId: string, key: string, value: unknown) => void;
  /** Read a plugin setting */
  getSetting: (pluginId: string, key: string) => unknown;
  /** Serialize a plugin to JSON string */
  exportPlugin: (id: string) => string;
  /** Deserialize and load a plugin from JSON string */
  importPlugin: (json: string) => void;
  /** Built-in plugin manifests available for install */
  builtinPlugins: PluginManifest[];
}

export function usePlugins(): UsePluginsReturn {
  const manager = useMemo(() => getPluginManager(), []);
  const [revision, setRevision] = useState(0);

  // Subscribe to all PluginManager events
  useEffect(() => {
    const unsubs = [
      manager.on("load", () => setRevision((n) => n + 1)),
      manager.on("unload", () => setRevision((n) => n + 1)),
      manager.on("enable", () => setRevision((n) => n + 1)),
      manager.on("disable", () => setRevision((n) => n + 1)),
      manager.on("settings-change", () => setRevision((n) => n + 1)),
      manager.on("tool-execute", () => setRevision((n) => n + 1)),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [manager]);

  // Read current state from manager
  const plugins = useMemo(
    () => manager.getAllPlugins(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, revision],
  );

  const tools = useMemo(
    () => manager.getPluginTools(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, revision],
  );

  const panels = useMemo(
    () => manager.getPluginPanels(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, revision],
  );

  const builtinPlugins = useMemo(() => manager.getBuiltinPlugins(), [manager]);

  const loadPlugin = useCallback(
    (manifest: PluginManifest, code?: string) => manager.loadPlugin(manifest, code),
    [manager],
  );

  const unloadPlugin = useCallback(
    (id: string) => manager.unloadPlugin(id),
    [manager],
  );

  const setEnabled = useCallback(
    (id: string, enabled: boolean) => manager.setEnabled(id, enabled),
    [manager],
  );

  const executeTool = useCallback(
    (pluginId: string, toolName: string, params: unknown) =>
      manager.executeTool(pluginId, toolName, params),
    [manager],
  );

  const getSettings = useCallback(
    (pluginId: string) => manager.getPluginSettings(pluginId),
    [manager],
  );

  const updateSetting = useCallback(
    (pluginId: string, key: string, value: unknown) =>
      manager.setPluginSetting(pluginId, key, value),
    [manager],
  );

  const getSetting = useCallback(
    (pluginId: string, key: string) => manager.getPluginSetting(pluginId, key),
    [manager],
  );

  const exportPlugin = useCallback(
    (id: string) => manager.exportPlugin(id),
    [manager],
  );

  const importPlugin = useCallback(
    (json: string) => manager.importPlugin(json),
    [manager],
  );

  // Silence unused variable warnings — revision is the reactivity trigger
  void revision;

  return {
    plugins,
    loadPlugin,
    unloadPlugin,
    setEnabled,
    executeTool,
    tools,
    panels,
    getSettings,
    updateSetting,
    getSetting,
    exportPlugin,
    importPlugin,
    builtinPlugins,
  };
}