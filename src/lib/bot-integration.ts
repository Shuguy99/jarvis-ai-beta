/**
 * JARVIS Bot Integration Framework
 * Server-side module for connecting JARVIS to Telegram and Discord
 *
 * Configuration is stored in settings. The actual bot polling/webhook
 * is managed by the Hono server.
 */

export interface BotConfig {
  enabled: boolean;
  platform: "telegram" | "discord" | null;
  token: string;
  chatId?: string;
  allowedUsers?: string[]; // Telegram user IDs or Discord user IDs
  prefix?: string; // Command prefix for Discord
  lastPollAt?: string;
}

export interface BotMessage {
  id: string;
  platform: "telegram" | "discord";
  userId: string;
  username: string;
  text: string;
  timestamp: string;
  replyTo?: string; // message ID to reply to
}

export interface BotStatus {
  telegram: { configured: boolean; connected: boolean; lastPoll?: string };
  discord: { configured: boolean; connected: boolean; lastPoll?: string };
}

const STORAGE_KEY = "jarvis-bot-config";

export function getBotConfig(platform: "telegram" | "discord"): BotConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${platform}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { enabled: false, platform, token: "", allowedUsers: [] };
}

export function saveBotConfig(config: BotConfig) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${config.platform}`, JSON.stringify(config));
  } catch { /* ignore */ }
}

export function isBotConfigured(platform: "telegram" | "discord"): boolean {
  const config = getBotConfig(platform);
  return config.enabled && config.token.length > 0;
}

/**
 * Send a message via Telegram Bot API
 */
export async function sendTelegramMessage(token: string, chatId: string, text: string, replyTo?: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: text.slice(0, 4096), // Telegram message limit
      parse_mode: "Markdown",
    };
    if (replyTo) body.reply_to_message_id = replyTo;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch (error) {
    console.error("Telegram send error:", error);
    return false;
  }
}

/**
 * Send a message via Discord Webhook (simpler than full bot)
 */
export async function sendDiscordMessage(webhookUrl: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: text.slice(0, 2000), // Discord message limit
        username: "J.A.R.V.I.S.",
      }),
    });
    return res.ok;
  } catch (error) {
    console.error("Discord send error:", error);
    return false;
  }
}

/**
 * Get Telegram bot updates (long polling simulation)
 */
export async function getTelegramUpdates(token: string, offset?: number): Promise<unknown[]> {
  try {
    const url = `https://api.telegram.org/bot${token}/getUpdates`;
    const params = new URLSearchParams({ timeout: "30", allowed_updates: '["message"]' });
    if (offset) params.set("offset", String(offset));

    const res = await fetch(`${url}?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.result || [];
  } catch {
    return [];
  }
}

/**
 * Format a JARVIS response for bot output
 */
export function formatForBot(text: string, platform: "telegram" | "discord"): string {
  let formatted = text;

  // Remove markdown that doesn't work in bots
  if (platform === "telegram") {
    // Telegram supports basic Markdown
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, "```\n$2\n```");
  } else {
    // Discord supports full Markdown
    formatted = formatted;
  }

  // Truncate if needed
  const limit = platform === "telegram" ? 4000 : 1900;
  if (formatted.length > limit) {
    formatted = formatted.slice(0, limit) + "\n\n_...сообщение обрезано_";
  }

  return formatted;
}