import { json } from "@/lib/json-response";
import { memoryStore } from "@/lib/memory-system";
import type { MemoryCategory } from "@/lib/types";

const VALID_CATEGORIES: MemoryCategory[] = ["preference", "fact", "context", "instruction", "project"];

export async function GET() {
  try {
    const memories = memoryStore.getAll();
    return json({ memories });
  } catch (error) {
    console.error("list memories error:", error);
    return json({ memories: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { content, category, source } = body;

    if (!content?.trim()) {
      return json({ error: "Content is required" }, 400);
    }

    const cat: MemoryCategory = VALID_CATEGORIES.includes(category) ? category : "fact";

    memoryStore.add({
      content: content.trim(),
      category: cat,
      timestamp: new Date().toISOString(),
      source: source === "auto" ? "auto" : "manual",
    });

    return json({ success: true }, 201);
  } catch (error) {
    console.error("create memory error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to create memory." },
      500
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, content } = body;

    if (!id) {
      return json({ error: "ID is required" }, 400);
    }
    if (!content?.trim()) {
      return json({ error: "Content is required" }, 400);
    }

    memoryStore.update(id, content.trim());
    return json({ success: true });
  } catch (error) {
    console.error("update memory error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to update memory." },
      500
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return json({ error: "ID is required" }, 400);
    }

    memoryStore.delete(id);
    return json({ success: true });
  } catch (error) {
    console.error("delete memory error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Failed to delete memory." },
      500
    );
  }
}