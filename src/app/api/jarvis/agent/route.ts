import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";
import { executeTool, getToolDefinitions } from "@/lib/agent-tools";
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

const MAX_TOOL_CALLS = 3;

// ─── POST ──────────────────────────────────────────────────────

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

    const addStep = (
      type: Step["type"],
      content: string,
      toolName?: string
    ) => {
      const step: Step = {
        id: ++stepId,
        type,
        content,
        timestamp: new Date().toISOString(),
        ...(toolName ? { toolName } : {}),
      };
      steps.push(step);
      return step;
    };

    // Build the system prompt with tool definitions
    const toolDefs = getToolDefinitions(enabledTools);

    const systemPrompt = `You are J.A.R.V.I.S., an advanced AI assistant by Stark Industries. You are operating in AGENT MODE — you have access to tools to help complete tasks.

When you need to use a tool, respond with ONLY a valid JSON object in this exact format (no markdown, no code fences, no extra text):
{"tool": "tool_name", "params": {"param1": "value1"}}

When you can answer directly without tools, just answer normally in plain text.

RULES:
- Read the task carefully and decide if you need a tool.
- If you use a tool, you will receive the result and can then give a final answer.
- You can call at most ${MAX_TOOL_CALLS} tools per task.
- If a tool fails, explain the error and try to give the best answer you can.
- Be concise but thorough. Format your final answer clearly.
- You may use multiple tools if needed (up to ${MAX_TOOL_CALLS} total).
- After receiving tool results, give your final answer in plain text.

${toolDefs}

IMPORTANT: When you want to call a tool, your ENTIRE response must be the JSON object only. No other text. No \`\`\`json markers. Just the raw JSON.`;

    // First LLM call
    addStep("thinking", `Analyzing task: "${task}"`);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: task },
    ];

    let llmResponse = await ai.chat(messages, {
      temperature: 0.3,
      maxTokens: 2048,
    });

    let toolCallCount = 0;

    // Loop: check if LLM wants to call a tool
    while (toolCallCount < MAX_TOOL_CALLS) {
      const trimmed = llmResponse.content.trim();

      // Try to parse as JSON tool call
      const parsed = tryParseToolCall(trimmed);

      if (!parsed) {
        // Not a tool call — this is the final answer
        addStep("final_answer", llmResponse.content);
        break;
      }

      // It's a tool call
      toolCallCount++;
      addStep(
        "tool_call",
        `Calling ${parsed.tool} with ${JSON.stringify(parsed.params)}`,
        parsed.tool
      );

      // Execute the tool
      const toolResult = await executeTool(
        parsed.tool,
        parsed.params as Record<string, string>
      );

      const resultStr = toolResult.display;
      toolCalls.push({
        tool: parsed.tool,
        params: parsed.params,
        result: resultStr,
      });

      addStep(
        "tool_result",
        toolResult.success
          ? resultStr.slice(0, 800)
          : `Error: ${toolResult.error ?? resultStr}`,
        parsed.tool
      );

      // Send the tool result back to the LLM for final answer
      messages.push({ role: "assistant" as const, content: trimmed });
      messages.push({
        role: "user" as const,
        content: `Tool "${parsed.tool}" result:\n${resultStr}\n\nNow provide your final answer based on this result. If you need another tool, respond with another JSON tool call.`,
      });

      llmResponse = await ai.chat(messages, {
        temperature: 0.3,
        maxTokens: 2048,
      });
    }

    // If we exhausted tool calls and LLM still wants a tool, force final answer
    if (toolCallCount >= MAX_TOOL_CALLS) {
      const maybeTool = tryParseToolCall(llmResponse.content.trim());
      if (maybeTool) {
        // Force a final summary instead
        messages.push({
          role: "user" as const,
          content:
            "You have reached the maximum number of tool calls. Please provide your final answer based on the information gathered so far. Do not call any more tools.",
        });
        llmResponse = await ai.chat(messages, {
          temperature: 0.3,
          maxTokens: 2048,
        });
      }
      addStep("final_answer", llmResponse.content);
    }

    return NextResponse.json({
      reply: llmResponse.content,
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

// ─── Helper: try to parse a tool call from LLM response ────────

function tryParseToolCall(
  text: string
): { tool: string; params: Record<string, unknown> } | null {
  // Strip markdown code fences if present
  let cleaned = text;
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.tool === "string" &&
      parsed.tool.length > 0
    ) {
      return {
        tool: parsed.tool,
        params: (parsed.params as Record<string, unknown>) ?? {},
      };
    }
  } catch {
    // Not valid JSON — not a tool call
  }

  return null;
}

// ─── GET: health check ─────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    name: "J.A.R.V.I.S. Agent",
    online: true,
    provider: ai.getProviderName(),
    maxToolCalls: MAX_TOOL_CALLS,
  });
}