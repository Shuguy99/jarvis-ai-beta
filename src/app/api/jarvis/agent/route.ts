import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";
import { executeTool, getToolDefinitionsForFunctionCalling } from "@/lib/agent-tools";
import { parseJsonBody, BodyLimitError } from "@/lib/body-limit";

export const runtime = "nodejs";

// ─── Types ─────────────────────────────────────────────────────

interface AgentRequestBody {
  task: string;
  tools?: string[];
}

interface Step {
  id: number;
  type: "thinking" | "tool_call" | "tool_result" | "final_answer";
  content: string;
  toolName?: string;
  timestamp: string;
}

interface ToolCallRecord {
  tool: string;
  params: Record<string, unknown>;
  result: string;
}

const MAX_TOOL_CALLS = 5;

// ─── POST: Agent with native function-calling ──────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<AgentRequestBody>(req);
    const { task, tools: enabledTools } = body;

    if (!task || !task.trim()) {
      return NextResponse.json(
        { error: "Task description is required." },
        { status: 400 }
      );
    }

    const steps: Step[] = [];
    const toolCalls: ToolCallRecord[] = [];
    let stepId = 0;

    const addStep = (type: Step["type"], content: string, toolName?: string) => {
      steps.push({ id: ++stepId, type, content, toolName, timestamp: new Date().toISOString() });
    };

    // Get tool definitions in OpenAI function-calling format
    const toolDefs = getToolDefinitionsForFunctionCalling(enabledTools);

    const systemPrompt = `You are J.A.R.V.I.S., an advanced AI assistant by Stark Industries. You are in AGENT MODE with access to tools.
Use the provided tools when needed. After receiving tool results, provide a clear final answer.
Be concise but thorough. Maximum ${MAX_TOOL_CALLS} tool calls per task.`;

    addStep("thinking", `Analyzing task: "${task}"`);

    // Build messages array (supports tool_call and tool role messages)
    const messages: Array<Record<string, unknown>> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: task },
    ];

    let toolCallCount = 0;
    let finalAnswer = "";

    // Agent loop
    while (toolCallCount < MAX_TOOL_CALLS) {
      // Call LLM with tools
      const response = await ai.chatWithTools(
        messages as unknown as import("@/lib/ai-provider").LLMMessage[],
        toolDefs,
        { temperature: 0.3, maxTokens: 4096 }
      );

      // If LLM returned a direct answer (no tool calls)
      if (!response.toolCalls || response.toolCalls.length === 0) {
        finalAnswer = response.content ?? "No response generated.";
        break;
      }

      // Process tool calls
      // Add assistant message with tool_calls to conversation
      const assistantMsg: Record<string, unknown> = { role: "assistant", content: response.content };
      if (response.toolCalls) {
        assistantMsg.tool_calls = response.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: tc.arguments },
        }));
      }
      messages.push(assistantMsg);

      // Execute each tool call and add results
      for (const tc of response.toolCalls) {
        toolCallCount++;
        let params: Record<string, unknown> = {};
        try {
          params = JSON.parse(tc.arguments);
        } catch {
          params = {};
        }

        addStep("tool_call", `Calling ${tc.name} with ${JSON.stringify(params)}`, tc.name);

        const toolResult = await executeTool(tc.name, params as Record<string, string>);

        const resultStr = toolResult.display;
        toolCalls.push({ tool: tc.name, params, result: resultStr });

        addStep(
          "tool_result",
          toolResult.success
            ? resultStr.slice(0, 800)
            : `Error: ${toolResult.error ?? resultStr}`,
          tc.name
        );

        // Add tool result message
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResult.success ? resultStr : `Error: ${toolResult.error ?? resultStr}`,
        });
      }
    }

    // If we exhausted tool calls, get a final summary
    if (!finalAnswer && toolCallCount >= MAX_TOOL_CALLS) {
      messages.push({
        role: "user",
        content: "You have reached the maximum number of tool calls. Provide your final answer based on the information gathered.",
      });

      const lastResponse = await ai.chatWithTools(
        messages as unknown as import("@/lib/ai-provider").LLMMessage[],
        [],
        { temperature: 0.3, maxTokens: 2048 }
      );
      finalAnswer = lastResponse.content ?? "Could not generate final answer.";
    }

    addStep("final_answer", finalAnswer);

    return NextResponse.json({
      reply: finalAnswer,
      toolCalls,
      steps,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    console.error("JARVIS agent error:", error);

    const msg =
      error instanceof Error ? error.message : "Internal J.A.R.V.I.S. agent error.";

    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("fetch failed") ||
      msg.includes("connect")
    ) {
      return NextResponse.json(
        {
          error:
            "Ollama not running. Start Ollama (ollama.com) and ensure the model is loaded: ollama pull llama3.1",
          ollamaNotRunning: true,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GET: health check ─────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    name: "J.A.R.V.I.S. Agent",
    online: true,
    provider: ai.getProviderName(),
    maxToolCalls: MAX_TOOL_CALLS,
    functionCalling: true,
  });
}