import { json } from "@/lib/json-response";

export async function GET() {
  try {
    // Return tool definitions for the agent to use
    // In a real implementation, this would read from DB
    // For now, return empty — the client manages tools locally
    return json({ tools: [] });
  } catch (error) {
    console.error("Tools API error:", error);
    return json({ error: "Ошибка получения тулов" }, 500);
  }
}