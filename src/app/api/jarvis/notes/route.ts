import { json } from "@/lib/json-response";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const notes = await db.note.findMany({
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });
    return json({ notes });
  } catch (error) {
    console.error("list notes error:", error);
    return json({ notes: [] });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, content, category, color, pinned } = body;

    if (!title?.trim() && !content?.trim()) {
      return json(
        { error: "Требуется title или content" },
        400
      );
    }

    const validCategories = ["general", "ideas", "code", "tasks", "personal"];
    const validColors = ["cyan", "emerald", "amber", "rose", "violet", "orange"];

    const note = await db.note.create({
      data: {
        title: title?.trim() || "Без названия",
        content: content?.trim() || "",
        done: false,
        category: validCategories.includes(category) ? category : "general",
        color: validColors.includes(color) ? color : "cyan",
        pinned: typeof pinned === "boolean" ? pinned : false,
      },
    });

    return json({ note }, 201);
  } catch (error) {
    console.error("create note error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Не удалось создать заметку." },
      500
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return json({ error: "Требуется id" }, 400);
    }

    const validCategories = ["general", "ideas", "code", "tasks", "personal"];
    const validColors = ["cyan", "emerald", "amber", "rose", "violet", "orange"];

    const updateData: Record<string, unknown> = {};
    if (typeof data.title === "string") updateData.title = data.title.trim();
    if (typeof data.content === "string") updateData.content = data.content.trim();
    if (typeof data.done === "boolean") updateData.done = data.done;
    if (typeof data.category === "string" && validCategories.includes(data.category)) {
      updateData.category = data.category;
    }
    if (typeof data.color === "string" && validColors.includes(data.color)) {
      updateData.color = data.color;
    }
    if (typeof data.pinned === "boolean") updateData.pinned = data.pinned;

    if (Object.keys(updateData).length === 0) {
      return json({ error: "Нет данных для обновления" }, 400);
    }

    const note = await db.note.update({
      where: { id },
      data: updateData,
    });

    return json({ note });
  } catch (error) {
    console.error("update note error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Не удалось обновить заметку." },
      500
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return json({ error: "Требуется id" }, 400);
    }

    if (id === "all") {
      await db.note.deleteMany({});
      return json({ success: true });
    }

    await db.note.delete({ where: { id } });
    return json({ success: true });
  } catch (error) {
    console.error("delete note error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Не удалось удалить заметку." },
      500
    );
  }
}