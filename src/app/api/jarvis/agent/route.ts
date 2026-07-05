/**
 * Agent Loop API Route — SSE streaming agent execution.
 *
 * POST: accepts { message, provider?, model?, tools? }
 * Returns SSE stream with real-time tool call progress.
 * Uses the AgentLoop class server-side with native function calling.
 */

import { ai } from "@/lib/ai-provider";
import { executeTool, getToolDefinitionsForFunctionCalling } from "@/lib/agent-tools";
import { AgentLoop } from "@/lib/agent-loop";
import type { FunctionToolDef, AgentLoopMessage, AgentAIResponse } from "@/lib/agent-loop";
import { parseJsonBody, BodyLimitError } from "@/lib/body-limit";

interface AgentRequestBody {
  message: string;
  provider?: string;
  model?: string;
  tools?: string[];
}

const MAX_ITERATIONS = 10;

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();

  let body: AgentRequestBody;
  try {
    body = await parseJsonBody<AgentRequestBody>(req);
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return new Response(
        sse({ type: "error", message: error.message }),
        {
          status: 413,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      );
    }
    return new Response(
      sse({ type: "error", message: "Invalid JSON in request body." }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  const { message, tools: enabledTools } = body;

  if (!message?.trim()) {
    return new Response(
      sse({ type: "error", message: "Message is required." }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      },
    );
  }

  const toolDefs: FunctionToolDef[] = getToolDefinitionsForFunctionCalling(enabledTools) as unknown as FunctionToolDef[];

  // Build the AI caller that bridges to the existing ai-provider
  const callAI: (
    messages: AgentLoopMessage[],
    tools: FunctionToolDef[],
    opts: { temperature: number; maxTokens: number },
    signal: AbortSignal,
  ) => Promise<AgentAIResponse> = async (messages, tools, opts, signal) => {
    const response = await ai.chatWithTools(
      messages as unknown as import("@/lib/ai-provider").LLMMessage[],
      tools as unknown as Parameters<typeof ai.chatWithTools>[1],
      { temperature: opts.temperature, maxTokens: opts.maxTokens },
    );

    // Respect abort signal
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    return {
      content: response.content,
      toolCalls: response.toolCalls,
    };
  };

  // Build the tool executor
  const toolExecutor = async (name: string, params: Record<string, string>) => {
    return executeTool(name, params);
  };

  const systemPrompt = `You are J.A.R.V.I.S., an advanced AI assistant by Stark Industries.
You are in AGENT MODE with access to tools. Use the tools when needed to accomplish the user's task.
After receiving tool results, analyze them and provide a clear final answer.
Be concise but thorough. If you already have enough information, respond directly.`;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(sse(data)));
      };

      try {
        const loop = new AgentLoop(callAI, toolExecutor, toolDefs, {
          maxIterations: MAX_ITERATIONS,
          systemPrompt,
          temperature: 0.3,
          maxTokens: 4096,
          onStatusChange(status) {
            send({ type: "status", status });
          },
          onToolCall(call) {
            send({ type: "tool_call", toolName: call.name, params: call.params });
          },
          onToolResult(result) {
            send({
              type: "tool_result",
              toolName: result.toolName,
              success: result.success,
              content: result.content.slice(0, 500),
            });
          },
          onToken(token) {
            send({ type: "chunk", text: token });
          },
          onLog(entry) {
            if (entry.type !== "tool_call" && entry.type !== "tool_result") {
              send({ type: "log", iteration: entry.iteration, logType: entry.type, content: entry.content, toolName: entry.toolName, timestamp: entry.timestamp });
            }
          },
        });

        // Track iterations via log callback override
        let currentIter = 0;
        const origOnLog = loop.getLog;
        // We get iterations from onToolCall timing instead

        // Run the loop
        await loop.run(message);

        // Send iteration count (best effort from the loop)
        send({ type: "iteration", iteration: loop.getIterations() });

        send({ type: "done" });
        controller.close();
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Agent loop error";

        if (
          msg.includes("ECONNREFUSED") ||
          msg.includes("fetch failed") ||
          msg.includes("connect")
        ) {
          send({
            type: "error",
            message:
              "AI provider not reachable. Start Ollama or configure your API key.",
          });
        } else if (msg.includes("AbortError") || msg.includes("cancelled")) {
          send({ type: "error", message: "Agent loop cancelled" });
        } else {
          send({ type: "error", message: msg });
        }
        controller.close();
      }
    },
    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  return new Response(
    JSON.stringify({
      name: "J.A.R.V.I.S. Agent Loop",
      online: true,
      provider: ai.getProviderName(),
      maxIterations: MAX_ITERATIONS,
      functionCalling: true,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}