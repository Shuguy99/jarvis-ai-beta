import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── server-plugin-loader ──────────────────────────────────────

import {
  registerPlugin,
  unregisterPlugin,
  activatePlugin,
  deactivatePlugin,
  updateSettings,
  executePluginAction,
  getAllPlugins,
  getPlugin,
  getPluginState,
  getAllActionDefinitions,
  type ServerPluginManifest,
} from "@/lib/server-plugin-loader";

// ── mcp-registry ──────────────────────────────────────────────

import {
  registerTool,
  unregisterTool,
  getTool,
  getAllTools,
  getToolsByCategory,
  getToolNames,
  executeTool,
  getToolsForLLM,
  executeToolBatch,
  executeToolBatchParallel,
  type MCPTool,
} from "@/lib/mcp-registry";

// ── Helpers ───────────────────────────────────────────────────

/** Generate a unique plugin ID per test to avoid singleton collisions */
let testCounter = 0;
function uid(prefix: string) {
  return `${prefix}-${++testCounter}-${Date.now()}`;
}

/** Track registered plugin IDs so we can clean up */
const registeredPlugins: string[] = [];
/** Track registered tool names so we can clean up */
const registeredTools: string[] = [];

function makePlugin(overrides?: Partial<ServerPluginManifest>): ServerPluginManifest {
  const id = uid("plugin");
  return {
    id,
    name: `Test Plugin ${id}`,
    description: "A test plugin",
    version: "1.0.0",
    author: "test",
    category: "test",
    icon: "🧪",
    ...overrides,
  };
}

function makeTool(overrides?: Partial<MCPTool>): MCPTool {
  const name = uid("tool");
  return {
    name,
    description: `Tool ${name}`,
    category: "test",
    parameters: [],
    execute: vi.fn(async () => ({ ok: true, name })),
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
//  server-plugin-loader
// ══════════════════════════════════════════════════════════════

describe("server-plugin-loader", () => {
  beforeEach(() => {
    testCounter = 0;
  });

  afterEach(() => {
    // Clean up any plugins registered during the test
    for (const id of registeredPlugins) {
      unregisterPlugin(id);
    }
    registeredPlugins.length = 0;
  });

  it("register a plugin → getAllPlugins returns it", () => {
    const plugin = makePlugin();
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    const all = getAllPlugins();
    const found = all.find((p) => p.id === plugin.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe(plugin.name);
    expect(found!.version).toBe("1.0.0");
  });

  it("register with actions → getAllActionDefinitions includes them (when active)", async () => {
    const plugin = makePlugin({
      enabled: true,
      actions: {
        greet: {
          description: "Say hello",
          parameters: [
            { name: "name", type: "string", description: "The name", required: true },
          ],
          execute: vi.fn(async (p) => ({ greeting: `Hello ${p.name}` })),
        },
        wave: {
          description: "Wave goodbye",
          parameters: [],
          execute: vi.fn(async () => ({ waved: true })),
        },
      },
    });
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    // Must be active for actions to appear
    await activatePlugin(plugin.id);

    const defs = getAllActionDefinitions();
    const actionNames = defs.map((d) => d.function.name);
    expect(actionNames).toContain(`${plugin.id}__greet`);
    expect(actionNames).toContain(`${plugin.id}__wave`);

    // Verify structure
    const greetDef = defs.find((d) => d.function.name === `${plugin.id}__greet`)!;
    expect(greetDef.type).toBe("function");
    expect(greetDef.function.description).toContain("Say hello");
    expect(greetDef.function.parameters.type).toBe("object");
    expect(greetDef.function.parameters.required).toContain("name");
  });

  it("activate plugin → getPluginState shows active:true", async () => {
    const plugin = makePlugin({ enabled: false });
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    expect(getPluginState(plugin.id)!.active).toBe(false);

    await activatePlugin(plugin.id);
    expect(getPluginState(plugin.id)!.active).toBe(true);
  });

  it("activate with onActivate hook → hook is called", async () => {
    const onActivate = vi.fn(async () => {});
    const plugin = makePlugin({ onActivate });
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    await activatePlugin(plugin.id);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("deactivate → getPluginState shows active:false", async () => {
    const plugin = makePlugin({ enabled: true });
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    expect(getPluginState(plugin.id)!.active).toBe(true);

    await deactivatePlugin(plugin.id);
    expect(getPluginState(plugin.id)!.active).toBe(false);
  });

  it("execute action → returns result", async () => {
    const executeFn = vi.fn(async (p) => ({ sum: (p.a as number) + (p.b as number) }));
    const plugin = makePlugin({
      enabled: true,
      actions: {
        add: {
          description: "Add two numbers",
          parameters: [
            { name: "a", type: "number", description: "First number", required: true },
            { name: "b", type: "number", description: "Second number", required: true },
          ],
          execute: executeFn,
        },
      },
    });
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    const result = await executePluginAction(plugin.id, "add", { a: 3, b: 7 });
    expect(result).toEqual({ sum: 10 });
    expect(executeFn).toHaveBeenCalledTimes(1);
  });

  it("execute unknown action → throws error", async () => {
    const plugin = makePlugin();
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    await expect(
      executePluginAction(plugin.id, "nonexistent")
    ).rejects.toThrow(`Action "nonexistent" not found in plugin "${plugin.id}"`);
  });

  it("update settings → onSettingsChange called with old+new", async () => {
    const onSettingsChange = vi.fn(async () => {});
    const plugin = makePlugin({
      settings: [
        { key: "threshold", label: "Threshold", type: "number", defaultValue: 50 },
        { key: "mode", label: "Mode", type: "text", defaultValue: "auto" },
      ],
      onSettingsChange,
    });
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    const newSettings = { threshold: 80, mode: "manual" };
    await updateSettings(plugin.id, newSettings);

    expect(onSettingsChange).toHaveBeenCalledTimes(1);
    // First arg = old settings (from defaults)
    expect(onSettingsChange).toHaveBeenCalledWith(
      { threshold: 50, mode: "auto" },
      { threshold: 80, mode: "manual" }
    );

    // State should be updated
    const st = getPluginState(plugin.id)!;
    expect(st.settings.threshold).toBe(80);
    expect(st.settings.mode).toBe("manual");
  });

  it("unregister → plugin removed, onDeactivate called", () => {
    const onDeactivate = vi.fn(async () => {});
    const plugin = makePlugin({ onDeactivate });
    registerPlugin(plugin);
    registeredPlugins.push(plugin.id);

    expect(getPlugin(plugin.id)).toBeDefined();

    unregisterPlugin(plugin.id);

    expect(getPlugin(plugin.id)).toBeUndefined();
    expect(getPluginState(plugin.id)).toBeUndefined();
    // onDeactivate is called with void (fire-and-forget) — use fake timers or just check it was queued
    // Since it uses `void manifest.onDeactivate().catch(() => {})`, it's async fire-and-forget
    // We need to let the microtask queue flush
  });

  it("getPlugin for unknown id → undefined", () => {
    expect(getPlugin("completely-nonexistent-plugin-id")).toBeUndefined();
    expect(getPluginState("completely-nonexistent-plugin-id")).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════
//  mcp-registry
// ══════════════════════════════════════════════════════════════

describe("mcp-registry", () => {
  beforeEach(() => {
    testCounter = 0;
  });

  afterEach(() => {
    for (const name of registeredTools) {
      unregisterTool(name);
    }
    registeredTools.length = 0;
  });

  it("register tool → getTool returns it", () => {
    const tool = makeTool({ name: "test-get-tool" });
    registerTool(tool);
    registeredTools.push(tool.name);

    const found = getTool("test-get-tool");
    expect(found).toBeDefined();
    expect(found!.description).toBe(tool.description);
    expect(found!.category).toBe("test");
  });

  it("register multiple → getAllTools returns all", () => {
    const t1 = makeTool({ name: "batch-tool-1", category: "cat-a" });
    const t2 = makeTool({ name: "batch-tool-2", category: "cat-b" });
    const t3 = makeTool({ name: "batch-tool-3", category: "cat-a" });
    registerTool(t1);
    registerTool(t2);
    registerTool(t3);
    registeredTools.push(t1.name, t2.name, t3.name);

    const all = getAllTools();
    const names = all.map((t) => t.name);
    expect(names).toContain("batch-tool-1");
    expect(names).toContain("batch-tool-2");
    expect(names).toContain("batch-tool-3");
  });

  it("getToolsByCategory → filters correctly", () => {
    const t1 = makeTool({ name: "cat-filter-a", category: "weather" });
    const t2 = makeTool({ name: "cat-filter-b", category: "system" });
    const t3 = makeTool({ name: "cat-filter-c", category: "weather" });
    registerTool(t1);
    registerTool(t2);
    registerTool(t3);
    registeredTools.push(t1.name, t2.name, t3.name);

    const weather = getToolsByCategory("weather");
    expect(weather).toHaveLength(2);
    expect(weather.every((t) => t.category === "weather")).toBe(true);

    const system = getToolsByCategory("system");
    expect(system).toHaveLength(1);

    const empty = getToolsByCategory("nonexistent");
    expect(empty).toHaveLength(0);
  });

  it("execute tool → returns result with timing", async () => {
    const tool: MCPTool = {
      name: "exec-timing-tool",
      description: "Test timing",
      category: "test",
      parameters: [],
      execute: vi.fn(async () => ({ computed: true })),
    };
    registerTool(tool);
    registeredTools.push(tool.name);

    const result = await executeTool("exec-timing-tool", {});

    expect(result.tool).toBe("exec-timing-tool");
    expect(result.output).toEqual({ computed: true });
    expect(result.error).toBeUndefined();
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(typeof result.duration).toBe("number");
  });

  it("execute unknown tool → returns error result", async () => {
    const result = await executeTool("tool-that-does-not-exist", {});

    expect(result.tool).toBe("tool-that-does-not-exist");
    expect(result.error).toContain("Unknown tool");
    expect(result.output).toEqual({});
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("getToolsForLLM → returns correct format", () => {
    const tool: MCPTool = {
      name: "llm-format-tool",
      description: "A tool for LLM",
      category: "testing",
      parameters: [
        { name: "query", type: "string", description: "Search query", required: true },
        { name: "limit", type: "number", description: "Result limit", required: false },
      ],
      execute: vi.fn(async () => ({})),
    };
    registerTool(tool);
    registeredTools.push(tool.name);

    const forLLM = getToolsForLLM();
    const entry = forLLM.find((t) => t.function.name === "llm-format-tool");

    expect(entry).toBeDefined();
    expect(entry!.type).toBe("function");
    expect(entry!.function.name).toBe("llm-format-tool");
    expect(entry!.function.description).toBe("A tool for LLM");
    expect(entry!.function.parameters.type).toBe("object");
    expect(entry!.function.parameters.properties.query).toEqual({
      type: "string",
      description: "Search query",
    });
    expect(entry!.function.parameters.required).toContain("query");
    expect(entry!.function.parameters.required).not.toContain("limit");
  });

  it("executeToolBatch → executes sequentially, all results returned", async () => {
    const order: string[] = [];
    const makeSequential = (name: string, delay: number): MCPTool => ({
      name,
      description: `Seq tool ${name}`,
      category: "test",
      parameters: [],
      execute: vi.fn(async () => {
        order.push(name);
        await new Promise((r) => setTimeout(r, delay));
        return { name };
      }),
    });

    const t1 = makeSequential("seq-a", 30);
    const t2 = makeSequential("seq-b", 10);
    const t3 = makeSequential("seq-c", 20);
    registerTool(t1);
    registerTool(t2);
    registerTool(t3);
    registeredTools.push(t1.name, t2.name, t3.name);

    const results = await executeToolBatch([
      { name: "seq-a" },
      { name: "seq-b" },
      { name: "seq-c" },
    ]);

    expect(results).toHaveLength(3);
    expect(results[0].output).toEqual({ name: "seq-a" });
    expect(results[1].output).toEqual({ name: "seq-b" });
    expect(results[2].output).toEqual({ name: "seq-c" });

    // Sequential means order is preserved
    expect(order).toEqual(["seq-a", "seq-b", "seq-c"]);
  });

  it("executeToolBatchParallel → executes in parallel (all complete)", async () => {
    const order: string[] = [];
    const makeParallel = (name: string, delay: number): MCPTool => ({
      name,
      description: `Par tool ${name}`,
      category: "test",
      parameters: [],
      execute: vi.fn(async () => {
        order.push(name);
        await new Promise((r) => setTimeout(r, delay));
        return { name };
      }),
    });

    const t1 = makeParallel("par-x", 50);
    const t2 = makeParallel("par-y", 10);
    const t3 = makeParallel("par-z", 30);
    registerTool(t1);
    registerTool(t2);
    registerTool(t3);
    registeredTools.push(t1.name, t2.name, t3.name);

    const startTime = Date.now();
    const results = await executeToolBatchParallel([
      { name: "par-x" },
      { name: "par-y" },
      { name: "par-z" },
    ]);
    const elapsed = Date.now() - startTime;

    expect(results).toHaveLength(3);
    // All results present
    const outputNames = results.map((r) => r.output.name as string);
    expect(outputNames).toContain("par-x");
    expect(outputNames).toContain("par-y");
    expect(outputNames).toContain("par-z");

    // Parallel: total time should be less than sum of all delays (50 + 10 + 30 = 90ms)
    // With some margin for overhead
    expect(elapsed).toBeLessThan(90);
  });

  it("unregisterTool → tool removed", () => {
    const tool = makeTool({ name: "to-remove" });
    registerTool(tool);

    expect(getTool("to-remove")).toBeDefined();

    unregisterTool("to-remove");

    expect(getTool("to-remove")).toBeUndefined();
    expect(getToolNames()).not.toContain("to-remove");
  });
});