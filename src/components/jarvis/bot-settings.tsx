import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { getBotConfig, saveBotConfig, sendTelegramMessage, sendDiscordMessage, formatForBot, type BotConfig } from "@/lib/bot-integration";
import { playSound } from "@/lib/sounds";

type Platform = "telegram" | "discord";

export function BotSettings() {
  const [telegram, setTelegram] = useState<BotConfig>(() => getBotConfig("telegram"));
  const [discord, setDiscord] = useState<BotConfig>(() => getBotConfig("discord"));
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [showDiscordToken, setShowDiscordToken] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleSave(platform: Platform) {
    playSound("success");
    const config = platform === "telegram" ? telegram : discord;
    saveBotConfig(config);
    setTestResult({ ok: true, msg: "Конфигурация сохранена" });
    setTimeout(() => setTestResult(null), 3000);
  }

  async function handleTest(platform: Platform) {
    setTesting(true);
    setTestResult(null);

    try {
      const config = platform === "telegram" ? telegram : discord;
      const testMessage = `🔔 JARVIS Bot Test\n\nСоединение установлено. Все системы работают корректно.\n\n— J.A.R.V.I.S.`;

      let success = false;
      if (platform === "telegram" && config.chatId) {
        success = await sendTelegramMessage(config.token, config.chatId, testMessage);
      } else if (platform === "discord") {
        success = await sendDiscordMessage(config.token, testMessage);
      }

      setTestResult({
        ok: success,
        msg: success ? "Тестовое сообщение отправлено!" : "Не удалось отправить. Проверьте токен и ID чата.",
      });
      playSound(success ? "success" : "error");
    } catch {
      setTestResult({ ok: false, msg: "Ошибка подключения" });
      playSound("error");
    }

    setTesting(false);
    setTimeout(() => setTestResult(null), 5000);
  }

  function BotConfigCard({ platform, config, setConfig, showToken, setShowToken }: {
    platform: Platform;
    config: BotConfig;
    setConfig: (c: BotConfig) => void;
    showToken: boolean;
    setShowToken: (v: boolean) => void;
  }) {
    const isTg = platform === "telegram";
    return (
      <div className="space-y-2 rounded-lg border border-primary/15 bg-card/30 p-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary">
            {isTg ? "Telegram Bot" : "Discord Webhook"}
          </span>
          <label className="ml-auto flex items-center gap-1.5 cursor-pointer">
            <span className="font-mono text-[9px] text-muted-foreground">{config.enabled ? "ON" : "OFF"}</span>
            <div
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative h-4 w-8 rounded-full transition-colors ${config.enabled ? "bg-primary" : "bg-muted"}`}
            >
              <motion.div
                className="absolute top-0.5 h-3 w-3 rounded-full bg-white"
                animate={{ left: config.enabled ? 16 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          </label>
        </div>

        <div className="space-y-1.5">
          <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
            {isTg ? "Bot Token" : "Webhook URL"}
          </label>
          <div className="flex gap-1">
            <input
              type={showToken ? "text" : "password"}
              value={config.token}
              onChange={e => setConfig({ ...config, token: e.target.value })}
              placeholder={isTg ? "123456:ABC-DEF..." : "https://discord.com/api/webhooks/..."}
              className="flex-1 rounded border border-primary/20 bg-background/60 px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="rounded border border-primary/20 px-1.5 text-muted-foreground hover:text-foreground transition"
            >
              {showToken ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {isTg && (
          <div className="space-y-1.5">
            <label className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Chat ID</label>
            <input
              value={config.chatId || ""}
              onChange={e => setConfig({ ...config, chatId: e.target.value })}
              placeholder="123456789"
              className="w-full rounded border border-primary/20 bg-background/60 px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
        )}

        <div className="flex gap-1.5 pt-1">
          <button
            onClick={() => handleSave(platform)}
            className="flex-1 rounded border border-primary/20 bg-primary/10 py-1 font-mono text-[9px] text-primary hover:bg-primary/20 transition"
          >
            Сохранить
          </button>
          <button
            onClick={() => handleTest(platform)}
            disabled={testing || !config.token}
            className="flex items-center justify-center gap-1 rounded border border-primary/30 bg-primary/5 py-1 px-3 font-mono text-[9px] text-primary hover:bg-primary/10 transition disabled:opacity-40"
          >
            <Send className="h-2.5 w-2.5" />
            <span>Тест</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary anim-pulse-glow" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-primary">Bot Integration</span>
      </div>

      <p className="font-mono text-[10px] text-muted-foreground">
        Подключите Telegram бота или Discord вебхук для удалённого доступа к JARVIS.
      </p>

      <BotConfigCard platform="telegram" config={telegram} setConfig={setTelegram} showToken={showTelegramToken} setShowToken={setShowTelegramToken} />
      <BotConfigCard platform="discord" config={discord} setConfig={setDiscord} showToken={showDiscordToken} setShowToken={setShowDiscordToken} />

      <AnimatePresence>
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className={`flex items-center gap-2 rounded-lg border p-2 ${
              testResult.ok ? "border-green-500/30 bg-green-500/10" : "border-destructive/30 bg-destructive/10"
            }`}
          >
            {testResult.ok ? <CheckCircle className="h-3.5 w-3.5 text-green-400" /> : <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
            <span className="font-mono text-[10px]">{testResult.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}