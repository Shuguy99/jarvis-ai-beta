/**
 * AgentLoop — Multi-step AI reasoning with tool-use cycle.
 *
 * The loop sends a user message to an AI provider with available tools
 * defined as OpenAI function schemas. The AI can either respond with text
 * (done) or request tool calls. If tool calls are requested, the loop
 * executes them, sends results back, and continues until a final text
 * response is received or the max iteration limit is hit.
 *
 * Designed to work both client-side (via SSE API route) and server-side
 * (by providing direct AI call and tool execution callbacks).
 */

import type {
  AgentStatus,
  AgentToolCall,
  AgentToolCallParsed,
  ToolCallResult,
  AgentLoopConfig,
  AgentLoopLogEntry,
} from "@/lib/types";

// ─── OpenAI function schema type (mirrors chatWithTools input) ──

export interface FunctionToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, { type: string; description: string; enum?: string[] }>;
      required: string[];
    };
  };
}

/** Shape returned by an AI call that may include tool calls */
export interface AgentAIResponse {
  content: string | null;
  toolCalls?: AgentToolCall[];
}

/** Callback to call the AI with messages + tools */
export type AgentAICaller = (
  messages: AgentLoopMessage[],
  tools: FunctionToolDef[],
  opts: { temperature: number; maxTokens: number },
  signal: AbortSignal,
) => Promise<AgentAIResponse>;

/** Callback to execute a tool by name */
export type AgentToolExecutor = (
  name: string,
  params: Record<string, string>,
) => Promise<{ success: boolean; display: string; error?: string }>;

/** A message in the agent loop's internal chain */
export interface AgentLoopMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

// ─── AgentLoop class ──────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `You are J.A.R.V.I.S., an advanced AI assistant by Stark Industries.
You are in AGENT MODE with access to tools. Use the tools when needed to accomplish the user's task.
After receiving tool results, analyze them and provide a clear final answer.
Be concise but thorough. If you already have enough information, respond directly.`;

export class AgentLoop {
  private messages: AgentLoopMessage[] = [];
  private status: AgentStatus = "idle";
  private iterations = 0;
  private log: AgentLoopLogEntry[] = [];
  private currentToolName: string | null = null;
  private abortController: AbortController | null = null;
  private result = "";
  private error: string | null = null;
  private config: AgentLoopConfig;

  private readonly callAI: AgentAICaller;
  private readonly executeTool: AgentToolExecutor;
  private readonly tools: FunctionToolDef[];

  constructor(
    callAI: AgentAICaller,
    executeTool: AgentToolExecutor,
    tools: FunctionToolDef[],
    config?: AgentLoopConfig,
  ) {
    this.callAI = callAI;
    this.executeTool = executeTool;
    this.tools = tools;
    this.config = config ?? {};
  }

  // ── Public getters ──────────────────────────────────────────

  getStatus(): AgentStatus { return this.status; }
  getIterations(): number { return this.iterations; }
  getCurrentTool(): string | null { return this.currentToolName; }
  getResult(): string { return this.result; }
  getError(): string | null { return this.error; }
  getLog(): AgentLoopLogEntry[] { return [...this.log]; }
  getMessages(): AgentLoopMessage[] { return [...this.messages]; }
  isRunning(): boolean { return this.status !== "idle"; }

  // ── Status helpers ──────────────────────────────────────────

  private setStatus(s: AgentStatus): void {
    this.status = s;
    this.config.onStatusChange?.(s);
  }

  private addLog(type: AgentLoopLogEntry["type"], content: string, toolName?: string): void {
    const entry: AgentLoopLogEntry = {
      iteration: this.iterations,
      type,
      toolName,
      content,
      timestamp: new Date().toISOString(),
    };
    this.log.push(entry);
    this.config.onLog?.(entry);
  }

  // ── Parse tool call arguments ──────────────────────────────

  private parseToolCall(tc: AgentToolCall): AgentToolCallParsed {
    let params: Record<string, unknown> = {};
    try {
      params = JSON.parse(tc.arguments);
    } catch {
      params = {};
    }
    return { id: tc.id, name: tc.name, params };
  }

  // ── Run the full loop ──────────────────────────────────────

  async run(userMessage: string): Promise<string> {
    if (this.isRunning()) {
      throw new Error("Agent loop is already running");
    }

    // Reset state
    this.messages = [];
    this.iterations = 0;
    this.log = [];
    this.result = "";
    this.error = null;
    this.currentToolName = null;
    this.abortController = new AbortController();

    const { maxIterations = 10, systemPrompt, temperature = 0.3, maxTokens = 4096 } = this.config;

    // Build initial messages
    this.messages.push({
      role: "system",
      content: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    });
    this.messages.push({
      role: "user",
      content: userMessage,
    });

    try {
      this.setStatus("thinking");
      this.addLog("thinking", `Starting agent loop for: "${userMessage.slice(0, 120)}"`);

      while (this.iterations < maxIterations) {
        if (this.abortController.signal.aborted) {
          this.error = "Agent loop cancelled";
          this.setStatus("idle");
          return this.result;
        }

        this.iterations++;
        this.setStatus("thinking");
        this.addLog("thinking", `Iteration ${this.iterations}: calling AI...`);

        // Call AI with current message chain + tools
        const response = await this.callAI(
          this.messages,
          this.tools,
          { temperature, maxTokens },
          this.abortController.signal,
        );

        // Case A: No tool calls → final text response
        if (!response.toolCalls || response.toolCalls.length === 0) {
          this.setStatus("responding");
          const text = response.content ?? "";
          this.result = text;

          // Stream tokens to caller
          for (const char of text) {
            if (this.abortController.signal.aborted) break;
            this.config.onToken?.(char);
          }

          this.addLog("response", text.slice(0, 500));
          this.setStatus("idle");
          return text;
        }

        // Case B: Tool calls → execute them and continue
        // Add assistant message with tool_calls to chain
        const assistantMsg: AgentLoopMessage = {
          role: "assistant",
          content: response.content ?? "",
          tool_calls: response.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function" as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
        this.messages.push(assistantMsg);

        // Execute all tool calls (potentially parallel)
        const parsedCalls = response.toolCalls.map((tc) => this.parseToolCall(tc));

        // Notify about each tool call
        for (const call of parsedCalls) {
          this.setStatus("calling-tool");
          this.currentToolName = call.name;
          this.addLog("tool_call", `Calling ${call.name}(${JSON.stringify(call.params)})`, call.name);
          this.config.onToolCall?.(call);
        }

        this.setStatus("processing");

        // Execute tool calls in parallel
        const results = await Promise.all(
          parsedCalls.map(async (call) => {
            const execResult = await this.executeTool(
              call.name,
              call.params as Record<string, string>,
            );
            const result: ToolCallResult = {
              toolCallId: call.id,
              toolName: call.name,
              success: execResult.success,
              content: execResult.success
                ? execResult.display.slice(0, 2000)
                : `Error: ${execResult.error ?? execResult.display}`,
              error: execResult.error,
            };
            return result;
          }),
        );

        // Add tool results to chain and notify
        for (const r of results) {
          this.addLog(
            "tool_result",
            r.success ? r.content.slice(0, 300) : r.content,
            r.toolName,
          );
          this.config.onToolResult?.(r);

          this.messages.push({
            role: "tool",
            content: r.content,
            tool_call_id: r.toolCallId,
          });
        }

        this.currentToolName = null;
      }

      // Max iterations reached — ask for final answer
      this.addLog("thinking", `Max iterations (${maxIterations}) reached, requesting final answer`);
      this.messages.push({
        role: "user",
        content: "You have reached the maximum number of tool calls. Provide your final answer based on the information gathered.",
      });

      const finalResponse = await this.callAI(
        this.messages,
        [], // no tools for final response
        { temperature, maxTokens },
        this.abortController.signal,
      );

      const text = finalResponse.content ?? "Could not generate final answer.";
      this.result = text;
      this.setStatus("responding");

      for (const char of text) {
        if (this.abortController.signal.aborted) break;
        this.config.onToken?.(char);
      }

      this.addLog("response", text.slice(0, 500));
      this.setStatus("idle");
      return text;
    } catch (err) {
      if (this.abortController.signal.aborted) {
        this.error = "Agent loop cancelled";
      } else {
        this.error = err instanceof Error ? err.message : "Agent loop error";
      }
      this.setStatus("idle");
      throw err;
    } finally {
      this.abortController = null;
      this.currentToolName = null;
    }
  }

  // ── Cancellation ───────────────────────────────────────────

  abort(): void {
    this.abortController?.abort();
    this.setStatus("idle");
    this.error = "Agent loop cancelled";
  }

  // ── Reset ──────────────────────────────────────────────────

  reset(): void {
    this.abort();
    this.messages = [];
    this.iterations = 0;
    this.log = [];
    this.result = "";
    this.error = null;
    this.currentToolName = null;
  }
}