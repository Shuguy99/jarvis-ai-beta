import { json } from "@/lib/json-response";
import { db } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const conv = await db.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conv) return json({ error: "Не найдено." }, 404);
    return json({ conversation: conv });
  } catch (error) {
    console.error("get conversation error:", error);
    return json({ error: "Ошибка." }, 500);
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { role, content } = await req.json();
    if (!role || !content) {
      return json({ error: "role и content обязательны." }, 400);
    }

    const msg = await db.message.create({
      data: { conversationId: id, role, content },
    });
    await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return json({ message: msg });
  } catch (error) {
    console.error("append message error:", error);
    return json({ error: "Ошибка." }, 500);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    await db.conversation.delete({ where: { id } });
    return json({ ok: true });
  } catch (error) {
    console.error("delete conversation error:", error);
    return json({ error: "Ошибка." }, 500);
  }
}