import type { ChatMessage } from "./types";

interface ExportOptions {
  title: string;
  messages: ChatMessage[];
  model: string;
  provider: string;
}

export function generateConversationHTML(opts: ExportOptions): string {
  const { title, messages, model, provider } = opts;

  const date = new Date().toLocaleString("ru-RU");

  const messageRows = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const isUser = m.role === "user";
      const avatar = isUser ? "👤" : "🤖";
      const label = isUser ? "Вы" : "JARVIS";
      const bgClass = isUser ? "user-msg" : "jarvis-msg";
      const time = m.createdAt
        ? new Date(m.createdAt).toLocaleTimeString("ru-RU")
        : "";

      // Simple markdown to HTML (basic)
      let content = m.content
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(
          /```(\w*)\n([\s\S]*?)```/g,
          "<pre><code class='lang-$1'>$2</code></pre>",
        )
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br>");

      return `
        <div class="message ${bgClass}">
          <div class="avatar">${avatar}</div>
          <div class="content">
            <div class="meta">${label} <span class="time">${time}</span></div>
            <div class="text">${content}</div>
          </div>
        </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — JARVIS Export</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0a0a0f; color: #e0e0e0; padding: 2rem;
      max-width: 800px; margin: 0 auto;
    }
    .header {
      border-bottom: 1px solid #00d4ff33; padding-bottom: 1rem; margin-bottom: 2rem;
    }
    .header h1 { color: #00d4ff; font-size: 1.25rem; font-family: monospace; }
    .header .meta { color: #666; font-size: 0.8rem; margin-top: 0.5rem; }
    .message { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; }
    .avatar { font-size: 1.25rem; flex-shrink: 0; margin-top: 2px; }
    .content { flex: 1; min-width: 0; }
    .meta { font-size: 0.75rem; color: #888; margin-bottom: 0.25rem; }
    .meta .time { color: #555; margin-left: 0.5rem; }
    .user-msg .text { color: #e0e0e0; }
    .jarvis-msg .text { color: #00d4ffcc; }
    code { background: #1a1a2e; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.9em; }
    pre { background: #1a1a2e; padding: 1rem; border-radius: 8px; overflow-x: auto; margin: 0.5rem 0; }
    pre code { background: none; padding: 0; }
    .footer { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #00d4ff22; color: #444; font-size: 0.75rem; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 ${title}</h1>
    <div class="meta">
      Экспорт от ${date} | ${provider} / ${model} | ${messages.length} сообщений
    </div>
  </div>
  ${messageRows}
  <div class="footer">
    Экспортировано из J.A.R.V.I.S. AI Assistant v19.0
  </div>
</body>
</html>`;
}

export function downloadHTML(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}