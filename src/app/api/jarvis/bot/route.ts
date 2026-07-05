import { json } from "@/lib/json-response";

export async function GET() {
  try {
    // Return bot configuration status
    // In a real implementation, this would check server-side config
    return json({
      telegram: { available: true, configured: false },
      discord: { available: true, configured: false },
      message: "Настройте бота в панели интеграций (настройки → интеграции)",
    });
  } catch (error) {
    console.error("Bot status error:", error);
    return json({ error: "Ошибка получения статуса бота" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { platform, token, chatId, message } = body as {
      platform?: string;
      token?: string;
      chatId?: string;
      message?: string;
    };

    if (!platform || !token || !message) {
      return json({ error: "Укажите platform, token и message" }, 400);
    }

    let success = false;

    if (platform === "telegram" && chatId) {
      const { sendTelegramMessage, formatForBot } = await import("@/lib/bot-integration");
      success = await sendTelegramMessage(token, chatId, formatForBot(message, "telegram"));
    } else if (platform === "discord") {
      // Discord uses webhook URL as "token"
      const { sendDiscordMessage, formatForBot } = await import("@/lib/bot-integration");
      success = await sendDiscordMessage(token, formatForBot(message, "discord"));
    } else {
      return json({ error: "Неподдерживаемая платформа" }, 400);
    }

    if (success) {
      return json({ success: true, message: "Сообщение отправлено" });
    } else {
      return json({ error: "Не удалось отправить сообщение" }, 500);
    }
  } catch (error) {
    console.error("Bot send error:", error);
    return json({ error: "Ошибка отправки" }, 500);
  }
}