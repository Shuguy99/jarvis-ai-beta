import { json } from "@/lib/json-response";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const totalConversations = await db.conversation.count();
    const totalMessages = await db.message.count();

    // Messages today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const messagesToday = await db.message.count({
      where: { createdAt: { gte: todayStart } },
    });

    // Messages this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const messagesThisWeek = await db.message.count({
      where: { createdAt: { gte: weekStart } },
    });

    // Active conversations (with messages in last 7 days)
    const activeConversations = await db.conversation.count({
      where: {
        messages: { some: { createdAt: { gte: weekStart } } },
      },
    });

    // Notes count
    const notesCount = await db.note.count();

    // Average messages per conversation
    const avgMessagesPerConversation =
      totalConversations > 0
        ? Math.round((totalMessages / totalConversations) * 10) / 10
        : 0;

    return json({
      totalConversations,
      totalMessages,
      messagesToday,
      messagesThisWeek,
      activeConversations,
      notesCount,
      avgMessagesPerConversation,
    });
  } catch (error) {
    console.error("[analytics] Error:", error);
    return json({ error: "Failed to load analytics" }, 500);
  }
}