import type { NextRequest } from "next/server";
import { ai } from "@/lib/ai-provider";
import { executeTool, getToolDefinitions } from "@/lib/agent-tools";
import { BodyLimitError } from "@/lib/body-limit";

export const runtime = "nodejs";

// ─── Constants ────────────────────────────────────────────────

const MAX_STEPS = 10;
const MAX_TOOL_CALLS_PER_STEP = 2;

// ─── Types ─────────────────────────────────────────────────────

interface PlanStep {
  id: number;
  description: string;
}

interface ExecuteRequestBody {
  task: string;
  tools?: string[];
}

// ─── SSE helper ────────────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ─── Tool call parser (same pattern as route.ts) ───────────────

function tryParseToolCall(
  text: string
): { tool: string; params: Record<string, unknown> } | null {
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

// ─── POST: SSE streaming agent execution ───────────────────────

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  let body: ExecuteRequestBody;
  try {
    const raw = await req.text();
    if (Buffer.byteLength(raw, "utf-8") > 1 * 1024 * 1024) {
      return new Response(
        sseEvent("error", { message: "Request body exceeds 1 MB limit" }),
        {
          status: 413,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }
    body = JSON.parse(raw) as ExecuteRequestBody;
  } catch (jsonErr) {
    if (jsonErr instanceof BodyLimitError) {
      return new Response(
        sseEvent("error", { message: jsonErr.message }),
        {
          status: 413,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }
    return new Response(
      sseEvent("error", { message: "Invalid JSON in request body." }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }

  const { task, tools: enabledTools } = body;

  if (!task || !task.trim()) {
    return new Response(
      sseEvent("error", { message: "Task description is required." }),
      {
        status: 400,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      }
    );
  }

  const toolDefs = getToolDefinitions(enabledTools);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      const sendError = (message: string) => {
        send("error", { message });
        controller.close();
      };

      try {
        // ── Phase 1: PLAN ──────────────────────────────────────
        const planPrompt = `You are J.A.R.V.I.S., an advanced AI assistant. You are given a task and must decompose it into a clear plan of action.

Decompose the following task into 1-8 concrete steps. Each step should be a specific action.

Respond with ONLY a valid JSON object in this exact format (no markdown, no code fences):
{"steps": [{"id": 1, "description": "..."}, {"id": 2, "description": "..."}]}

Task: ${task}`;

        let planResponse: string;
        try {
          const planResult = await ai.chat(
            [
              { role: "system", content: "You are a task planning assistant. Respond only with valid JSON." },
              { role: "user", content: planPrompt },
            ],
            { temperature: 0.3, maxTokens: 2048 }
          );
          planResponse = planResult.content.trim();
        } catch (err) {
          sendError(`LLM error during planning: ${err instanceof Error ? err.message : String(err)}`);
          return;
        }

        let steps: PlanStep[] = [];
        try {
          let cleaned = planResponse;
          const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
          if (fenceMatch) cleaned = fenceMatch[1].trim();
          const planParsed = JSON.parse(cleaned);
          if (Array.isArray(planParsed.steps)) {
            steps = planParsed.steps
              .slice(0, MAX_STEPS)
              .map((s: { id?: number; description?: string }, i: number) => ({
                id: s.id ?? i + 1,
                description: String(s.description ?? ""),
              }))
              .filter((s: PlanStep) => s.description.length > 0);
          }
        } catch {
          // Parsing failed — create a single fallback step
        }

        if (steps.length === 0) {
          steps = [{ id: 1, description: task.trim() }];
        }

        send("plan", { steps });

        // ── Phase 2: EXECUTE ───────────────────────────────────
        const stepSummaries: string[] = [];

        const stepSystemPrompt = `You are J.A.R.V.I.S., an advanced AI assistant by Stark Industries. You are executing a specific step of a larger task.

When you need to use a tool, respond with ONLY a valid JSON object (no markdown, no code fences):
{"tool": "tool_name", "params": {"param1": "value1"}}

When you can respond with findings directly, just answer in plain text.

RULES:
- You can call at most ${MAX_TOOL_CALLS_PER_STEP} tools per step.
- If a tool fails, explain the error and provide the best answer you can.
- Be concise. Summarize your findings clearly.
- After receiving tool results, summarize your findings in plain text.

${toolDefs}

IMPORTANT: When calling a tool, your ENTIRE response must be the JSON object only.`;

        for (const step of steps) {
          if (req.signal.aborted) break;

          send("step_start", { stepId: step.id, description: step.description });

          const stepMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
            { role: "system", content: stepSystemPrompt },
            {
              role: "user",
              content: `Execute this step: ${step.description}`,
            },
          ];

          let toolCallsInStep = 0;
          let stepSummary = "";

          while (toolCallsInStep < MAX_TOOL_CALLS_PER_STEP) {
            if (req.signal.aborted) break;

            let llmResponse: string;
            try {
              const result = await ai.chat(stepMessages, {
                temperature: 0.3,
                maxTokens: 2048,
              });
              llmResponse = result.content.trim();
            } catch (err) {
              stepSummary = `Error calling LLM: ${err instanceof Error ? err.message : String(err)}`;
              break;
            }

            const parsed = tryParseToolCall(llmResponse);

            if (!parsed) {
              // Not a tool call — this is the findings/thinking
              send("step_progress", {
                stepId: step.id,
                type: "thinking",
                content: llmResponse,
              });
              stepSummary = llmResponse;
              break;
            }

            // It's a tool call
            toolCallsInStep++;
            const callDesc = `Calling ${parsed.tool} with ${JSON.stringify(parsed.params)}`;

            send("step_progress", {
              stepId: step.id,
              type: "tool_call",
              content: callDesc,
              toolName: parsed.tool,
            });

            const toolResult = await executeTool(
              parsed.tool,
              parsed.params as Record<string, string>
            );

            const resultContent =
              toolResult.success && !toolResult.error
                ? toolResult.display.slice(0, 500)
                : `Error: ${toolResult.error ?? toolResult.display}`;

            send("step_progress", {
              stepId: step.id,
              type: "tool_result",
              content: resultContent,
              toolName: parsed.tool,
            });

            // Feed result back to LLM for this step
            stepMessages.push({ role: "assistant", content: llmResponse });
            stepMessages.push({
              role: "user",
              content: `Tool "${parsed.tool}" result:\n${toolResult.display}\n\nNow summarize your findings for this step. If you need another tool (max ${MAX_TOOL_CALLS_PER_STEP}), respond with another JSON tool call.`,
            });

            // After the tool loop ends (either tool limit or no more tools),
            // we'll do one more LLM call to get the final summary
            if (toolCallsInStep >= MAX_TOOL_CALLS_PER_STEP) {
              try {
                const finalResult = await ai.chat(stepMessages, {
                  temperature: 0.3,
                  maxTokens: 2048,
                });
                const finalText = finalResult.content.trim();
                send("step_progress", {
                  stepId: step.id,
                  type: "thinking",
                  content: finalText,
                });
                stepSummary = finalText;
              } catch {
                stepSummary = "Step completed but summary generation failed.";
              }
            }
          }

          // If we used tools but the loop ended naturally (not via tool limit),
          // stepSummary should already be set. If empty, set a default.
          if (!stepSummary) {
            stepSummary = `Step ${step.id} completed.`;
          }

          stepSummaries.push(stepSummary);

          send("step_done", {
            stepId: step.id,
            success: true,
            summary: stepSummary,
          });
        }

        // ── Phase 3: REPORT ────────────────────────────────────
        if (req.signal.aborted) {
          send("done", {});
          controller.close();
          return;
        }

        let report = "";
        try {
          const reportMessages = [
            {
              role: "system" as const,
              content:
                "Ты — J.A.R.V.I.S., ИИ-ассистент из Железного Человека. Напиши краткий итоговый отчёт на русском языке о том, что было сделано. Отчёт должен быть лаконичным и информативным. Не используй markdown-заголовки, просто напиши текст.",
            },
            {
              role: "user" as const,
              content: `Задача: ${task}\n\nРезультаты шагов:\n${stepSummaries.map((s, i) => `Шаг ${i + 1}: ${s}`).join("\n\n")}\n\nНапиши краткий итоговый отчёт.`,
            },
          ];

          const reportResult = await ai.chat(reportMessages, {
            temperature: 0.3,
            maxTokens: 2048,
          });
          report = reportResult.content.trim();
        } catch {
          report = stepSummaries.join("\n\n");
        }

        send("report", { content: report });
        send("done", {});
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal agent error";
        send("error", { message });
      } finally {
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