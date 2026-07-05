import { useState } from "react";
import { Download, FileCode, FileText } from "lucide-react";
import { playSound } from "@/lib/sounds";
import type { ChatMessage } from "@/lib/types";
import {
  generateConversationHTML,
  downloadHTML,
} from "@/lib/export-html";

interface ConversationExportProps {
  messages: ChatMessage[];
  conversationTitle?: string;
  model?: string;
  provider?: string;
}

export function ConversationExport({
  messages,
  conversationTitle,
  model = "unknown",
  provider = "unknown",
}: ConversationExportProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleExportMarkdown() {
    const date = new Date().toISOString();
    const title = conversationTitle || "Untitled";

    const sections = messages
      .map((msg) => {
        const heading = msg.role === "user" ? "User" : "J.A.R.V.I.S.";
        return `## ${heading}\n${msg.content}`;
      })
      .join("\n\n");

    const markdown = [
      `# J.A.R.V.I.S. — Session Log`,
      `**Date:** ${date}`,
      `**Title:** ${title}`,
      `---`,
      ``,
      sections,
    ].join("\n");

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jarvis-session-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    playSound("success");
    setMenuOpen(false);
  }

  function handleExportHTML() {
    const title = conversationTitle || "Untitled";
    const html = generateConversationHTML({
      title,
      messages,
      model,
      provider,
    });
    const safeName = title.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, "_").slice(0, 40);
    downloadHTML(html, `jarvis-${safeName}-${Date.now()}.html`);

    playSound("success");
    setMenuOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          playSound("click");
          setMenuOpen((v) => !v);
        }}
        className="rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary"
      >
        <span className="flex items-center gap-1.5">
          <Download className="h-3 w-3" />
          <span className="hidden sm:inline">EXPORT</span>
        </span>
      </button>

      {menuOpen && (
        <>
          {/* Backdrop to close menu on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[180px] rounded-lg border jarvis-border-cyan bg-card/95 p-1 shadow-xl backdrop-blur-md">
            <button
              type="button"
              onClick={handleExportMarkdown}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Markdown (.md)</span>
            </button>
            <button
              type="button"
              onClick={handleExportHTML}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-mono text-[11px] text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>HTML (.html)</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}