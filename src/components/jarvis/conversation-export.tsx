"use client";

import { Download } from "lucide-react";
import { playSound } from "@/lib/sounds";
import type { ChatMessage } from "@/lib/types";

interface ConversationExportProps {
  messages: ChatMessage[];
  conversationTitle?: string;
}

export function ConversationExport({ messages, conversationTitle }: ConversationExportProps) {
  function handleExport() {
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
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-full border jarvis-border-cyan bg-card/40 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/50 hover:text-primary"
    >
      <span className="flex items-center gap-1.5">
        <Download className="h-3 w-3" />
        <span className="hidden sm:inline">EXPORT</span>
      </span>
    </button>
  );
}