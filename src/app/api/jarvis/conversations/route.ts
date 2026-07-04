import { json } from "@/lib/json-response";
import { db } from "@/lib/db";
import { deriveTitle } from "@/lib/jarvis";

export async function GET() {
  try {
    const convos = await db.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return json({ conversations: convos });
  } catch (error) {
    console.error("list conversations error:", error);
    return json({ conversations: [] });
  }
}

export async function POST(req: Request) {
  try {
    const { message, role = "user", title } = await req.json();

    const conv = await db.conversation.create({
      data: {
        title: title ?? (message ? deriveTitle(message) : "New Session"),
        messages:
          message && message.trim()
            ? {
                create: [
                  {
                    role,
                    content: message,
                  },
                ],
              }
            : undefined,
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    return json({ conversation: conv });
  } catch (error) {
    console.error("create conversation error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Не удалось создать сессию." },
      500
    );
  }
}