import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET /api/jarvis/notes — list all notes (updatedAt desc)
 * POST /api/jarvis/notes — create note { title, content }
 */
export async function GET() {
  try {
    const notes = await db.note.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("list notes error:", error);
    return NextResponse.json({ notes: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, content } = body;

    if (!title?.trim() && !content?.trim()) {
      return NextResponse.json(
        { error: "Требуется title или content" },
        { status: 400 }
      );
    }

    const note = await db.note.create({
      data: {
        title: title?.trim() || "Без названия",
        content: content?.trim() || "",
        done: false,
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("create note error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать заметку." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/jarvis/notes — update note { id, title?, content?, done? }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "Требуется id" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (typeof data.title === "string") updateData.title = data.title.trim();
    if (typeof data.content === "string") updateData.content = data.content.trim();
    if (typeof data.done === "boolean") updateData.done = data.done;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Нет данных для обновления" }, { status: 400 });
    }

    const note = await db.note.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error("update note error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось обновить заметку." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jarvis/notes — delete note by id
 * Body: { id }
 * If id === "all" — delete all notes
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Требуется id" }, { status: 400 });
    }

    if (id === "all") {
      await db.note.deleteMany({});
      return NextResponse.json({ success: true });
    }

    await db.note.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("delete note error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось удалить заметку." },
      { status: 500 }
    );
  }
}