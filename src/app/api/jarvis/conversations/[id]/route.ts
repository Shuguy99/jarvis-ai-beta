import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/**
 * GET    /api/jarvis/conversations/[id] -> get one with messages
 * POST   /api/jarvis/conversations/[id] -> append message  body: { role, content }
 * DELETE /api/jarvis/conversations/[id] -> delete conversation
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const conv = await db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv) return NextResponse.json({ error: "Не найдено." }, { status: 404 });
    return NextResponse.json({ conversation: conv });
  } catch (error) {
    console.error("get conversation error:", error);
    return NextResponse.json({ error: "Ошибка." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { role, content } = await req.json();
    if (!role || !content) {
      return NextResponse.json({ error: "role и content обязательны." }, { status: 400 });
    }

    const msg = await db.message.create({
      data: { conversationId: id, role, content },
    });
    await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ message: msg });
  } catch (error) {
    console.error("append message error:", error);
    return NextResponse.json({ error: "Ошибка." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.conversation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("delete conversation error:", error);
    return NextResponse.json({ error: "Ошибка." }, { status: 500 });
  }
}
