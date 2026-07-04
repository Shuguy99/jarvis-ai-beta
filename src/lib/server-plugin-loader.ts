/**
 * Server-side Plugin Loader with Lifecycle Hooks
 *
 * Each plugin can define:
 *   - onActivate(): called when plugin is enabled
 *   - onDeactivate(): called when plugin is disabled
 *   - onSettingsChange(oldSettings, newSettings): called when settings are updated
 *   - actions: Record<string, PluginAction> — server-executable tools
 *
 * Plugins are defined as plain objects (no dynamic imports for security).
 * Use registerPlugin() to add them at startup.
 */

export interface PluginAction {
  description: string;
  parameters: Array<{ name: string; type: string; description: string; required?: boolean }>;
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface ServerPluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  icon: string;
  enabled?: boolean;
  settings?: Array<{
    key: string;
    label: string;
    type: "toggle" | "select" | "number" | "text";
    defaultValue: string | number | boolean;
    options?: string[];
  }>;
  actions?: Record<string, PluginAction>;
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
  onSettingsChange?: (oldSettings: Record<string, unknown>, newSettings: Record<string, unknown>) => Promise<void>;
}

// ─── Registry ────────────────────────────────────────────────────

const registry = new Map<string, ServerPluginManifest>();
const state = new Map<string, { active: boolean; settings: Record<string, unknown> }>();

/** Register a server-side plugin with its manifest and lifecycle hooks */
export function registerPlugin(manifest: ServerPluginManifest): void {
  registry.set(manifest.id, manifest);
  state.set(manifest.id, {
    active: manifest.enabled ?? false,
    settings: Object.fromEntries(
      (manifest.settings ?? []).map((s) => [s.key, s.defaultValue])
    ),
  });
}

/** Unregister a server-side plugin */
export function unregisterPlugin(id: string): void {
  const manifest = registry.get(id);
  if (manifest?.onDeactivate) {
    void manifest.onDeactivate().catch(() => {});
  }
  registry.delete(id);
  state.delete(id);
}

/** Activate a plugin (calls onActivate lifecycle hook) */
export async function activatePlugin(id: string): Promise<boolean> {
  const manifest = registry.get(id);
  if (!manifest) return false;

  try {
    if (manifest.onActivate) await manifest.onActivate();
    const s = state.get(id);
    if (s) s.active = true;
    return true;
  } catch (err) {
    console.error(`Plugin ${id} onActivate failed:`, err);
    return false;
  }
}

/** Deactivate a plugin (calls onDeactivate lifecycle hook) */
export async function deactivatePlugin(id: string): Promise<boolean> {
  const manifest = registry.get(id);
  if (!manifest) return false;

  try {
    if (manifest.onDeactivate) await manifest.onDeactivate();
    const s = state.get(id);
    if (s) s.active = false;
    return true;
  } catch (err) {
    console.error(`Plugin ${id} onDeactivate failed:`, err);
    return false;
  }
}

/** Update plugin settings (calls onSettingsChange lifecycle hook) */
export async function updateSettings(
  id: string,
  newSettings: Record<string, unknown>
): Promise<boolean> {
  const manifest = registry.get(id);
  const s = state.get(id);
  if (!manifest || !s) return false;

  try {
    if (manifest.onSettingsChange) {
      await manifest.onSettingsChange(s.settings, newSettings);
    }
    s.settings = { ...s.settings, ...newSettings };
    return true;
  } catch (err) {
    console.error(`Plugin ${id} onSettingsChange failed:`, err);
    return false;
  }
}

/** Execute a plugin action */
export async function executePluginAction(
  pluginId: string,
  actionName: string,
  params: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const manifest = registry.get(pluginId);
  if (!manifest?.actions?.[actionName]) {
    throw new Error(`Action "${actionName}" not found in plugin "${pluginId}"`);
  }

  const action = manifest.actions[actionName];
  const s = state.get(pluginId);
  const mergedParams = { ...s?.settings, ...params };

  return action.execute(mergedParams);
}

/** Get all registered plugin manifests */
export function getAllPlugins(): ServerPluginManifest[] {
  return Array.from(registry.values());
}

/** Get a specific plugin */
export function getPlugin(id: string): ServerPluginManifest | undefined {
  return registry.get(id);
}

/** Get plugin runtime state */
export function getPluginState(id: string): { active: boolean; settings: Record<string, unknown> } | undefined {
  return state.get(id);
}

/** Get all action definitions for LLM tool-calling format */
export function getAllActionDefinitions(): Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}> {
  const definitions: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: {
        type: "object";
        properties: Record<string, { type: string; description: string }>;
        required: string[];
      };
    };
  }> = [];

  for (const [pluginId, manifest] of registry) {
    if (!state.get(pluginId)?.active || !manifest.actions) continue;

    for (const [actionName, action] of Object.entries(manifest.actions)) {
      definitions.push({
        type: "function",
        function: {
          name: `${pluginId}__${actionName}`,
          description: `[${manifest.name}] ${action.description}`,
          parameters: {
            type: "object",
            properties: Object.fromEntries(
              action.parameters.map((p) => [p.name, { type: p.type, description: p.description }])
            ),
            required: action.parameters.filter((p) => p.required !== false).map((p) => p.name),
          },
        },
      });
    }
  }

  return definitions;
}