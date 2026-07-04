import type { NextRequest } from "next/server";
import { ai } from "@/lib/ai-provider";
import { executeTool, getToolDefinitionsForFunctionCalling } from "@/lib/agent-tools";
import { parseJsonBody, BodyLimitError } from "@/lib/body-limit";

export const runtime = "nodejs";

interface AgentRequestBody {
  task: string;
  tools?: string[];
}

const MAX_TOOL_CALLS = 5;

/**
 * POST /api/jarvis/agent/stream
 * Streaming agent with native function-calling.
 * SSE events: { type: "step" }, { type: "tool_call" }, { type: "tool_result" }, { type: "chunk" }, { type: "done" }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await parseJsonBody<AgentRequestBody>(req);
    const { task, tools: enabledTools } = body;

    if (!task?.trim()) {
      return new Response(JSON.stringify({ error: "Task required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const toolDefs = getToolDefinitionsForFunctionCalling(enabledTools);
    const systemPrompt = `You are J.A.R.V.I.S., Stark Industries AI. Agent mode with tools. Be concise, max ${MAX_TOOL_CALLS} tool calls.`;

    const encoder = new TextEncoder();
    const send = (data: unknown) => `data: ${JSON.stringify(data)}\n\n`;

    const stream = new ReadableStream({
      async start(controller) {
        const messages: Array<Record<string, unknown>> = [
          { role: "system", content: systemPrompt },
          { role: "user", content: task },
        ];

        let toolCallCount = 0;

        try {
          controller.enqueue(encoder.encode(send({ type: "step", content: `Analyzing: "${task}"` })));

          while (toolCallCount < MAX_TOOL_CALLS) {
            const response = await ai.chatWithTools(
              messages as unknown as import("@/lib/ai-provider").LLMMessage[],
              toolDefs,
              { temperature: 0.3, maxTokens: 4096 }
            );

            // Direct answer, no tool calls
            if (!response.toolCalls?.length) {
              const text = response.content ?? "";
              for (const word of text.split(" ")) {
                controller.enqueue(encoder.encode(send({ type: "chunk", text: word + " " })));
              }
              break;
            }

            // Process tool calls
            const assistantMsg: Record<string, unknown> = { role: "assistant", content: response.content };
            assistantMsg.tool_calls = response.toolCalls.map((tc) => ({
              id: tc.id, type: "function",
              function: { name: tc.name, arguments: tc.arguments },
            }));
            messages.push(assistantMsg);

            for (const tc of response.toolCalls) {
              toolCallCount++;
              let params: Record<string, unknown> = {};
              try { params = JSON.parse(tc.arguments); } catch { /* empty */ }

              controller.enqueue(encoder.encode(send({
                type: "tool_call",
                toolName: tc.name,
                params,
              })));

              const result = await executeTool(tc.name, params as Record<string, string>);

              controller.enqueue(encoder.encode(send({
                type: "tool_result",
                toolName: tc.name,
                success: result.success,
                display: (result.success ? result.display : `Error: ${result.error}`).slice(0, 600),
              })));

              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: result.success ? result.display : `Error: ${result.error}`,
              });
            }
          }

          // Exhausted calls — get summary
          if (toolCallCount >= MAX_TOOL_CALLS) {
            messages.push({ role: "user", content: "Provide final answer from gathered info." });
            const final = await ai.chatWithTools(
              messages as unknown as import("@/lib/ai-provider").LLMMessage[],
              [], { temperature: 0.3, maxTokens: 2048 }
            );
            const text = final.content ?? "";
            for (const word of text.split(" ")) {
              controller.enqueue(encoder.encode(send({ type: "chunk", text: word + " " })));
            }
          }

          controller.enqueue(encoder.encode(send({ type: "done" })));
          controller.close();
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Agent stream error";
          controller.enqueue(encoder.encode(send({ type: "error", message: msg })));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    if (error instanceof BodyLimitError) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 413, headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: "Agent stream error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
}