/**
 * MCP (Model Context Protocol) Tool Registry
 *
 * Shared tool registry that both the chat system and the agent system
 * can use to provide capabilities to the LLM.
 *
 * Tools are registered at module level and can be discovered/invoked
 * by any consumer.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface MCPToolParam {
  name: string;
  type: "string" | "number" | "boolean" | "object";
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  parameters: MCPToolParam[];
  execute: (params: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

export interface MCPToolResult {
  tool: string;
  output: Record<string, unknown>;
  error?: string;
  duration: number;
}

// ─── Registry ────────────────────────────────────────────────────

const tools = new Map<string, MCPTool>();

export function registerTool(tool: MCPTool): void {
  tools.set(tool.name, tool);
}

export function unregisterTool(name: string): void {
  tools.delete(name);
}

export function getTool(name: string): MCPTool | undefined {
  return tools.get(name);
}

export function getAllTools(): MCPTool[] {
  return Array.from(tools.values());
}

export function getToolsByCategory(category: string): MCPTool[] {
  return getAllTools().filter((t) => t.category === category);
}

export function getToolNames(): string[] {
  return Array.from(tools.keys());
}

/**
 * Execute a tool by name with given parameters.
 * Returns structured result with timing and error handling.
 */
export async function executeTool(
  name: string,
  params: Record<string, unknown> = {}
): Promise<MCPToolResult> {
  const start = Date.now();
  const tool = tools.get(name);

  if (!tool) {
    return {
      tool: name,
      output: {},
      error: `Unknown tool: ${name}`,
      duration: Date.now() - start,
    };
  }

  try {
    const output = await tool.execute(params);
    return {
      tool: name,
      output,
      duration: Date.now() - start,
    };
  } catch (err) {
    return {
      tool: name,
      output: {},
      error: err instanceof Error ? err.message : String(err),
      duration: Date.now() - start,
    };
  }
}

/**
 * Get a JSON-formatted tool description for LLM function-calling prompts.
 * Returns the tools array in OpenAI function-calling format.
 */
export function getToolsForLLM(): Array<{
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
  return getAllTools().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          tool.parameters.map((p) => [
            p.name,
            { type: p.type === "object" ? "object" : p.type, description: p.description },
          ])
        ),
        required: tool.parameters.filter((p) => p.required !== false).map((p) => p.name),
      },
    },
  }));
}

/**
 * Execute multiple tools sequentially (for agent multi-step).
 */
export async function executeToolBatch(
  calls: Array<{ name: string; params?: Record<string, unknown> }>
): Promise<MCPToolResult[]> {
  const results: MCPToolResult[] = [];
  for (const call of calls) {
    results.push(await executeTool(call.name, call.params ?? {}));
  }
  return results;
}

/**
 * Execute multiple tools in parallel (Promise.all).
 * Use when tools have no dependencies between them.
 */
export async function executeToolBatchParallel(
  calls: Array<{ name: string; params?: Record<string, unknown> }>
): Promise<MCPToolResult[]> {
  return Promise.all(
    calls.map((call) => executeTool(call.name, call.params ?? {}))
  );
}