import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { deriveTitle } from "@/lib/jarvis";

export const runtime = "nodejs";

/**
 * GET /api/jarvis/conversations  -> list all (latest first)
 * POST /api/jarvis/conversations -> create + optionally add first message
 *   body: { message?: string, role?: "user"|"assistant", title?: string }
 */
export async function GET() {
  try {
    const convos = await db.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ conversations: convos });
  } catch (error) {
    console.error("list conversations error:", error);
    return NextResponse.json({ conversations: [] });
  }
}

export async function POST(req: NextRequest) {
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

    return NextResponse.json({ conversation: conv });
  } catch (error) {
    console.error("create conversation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать сессию." },
      { status: 500 }
    );
  }
}
