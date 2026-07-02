"use client";

import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { Copy, Check, Terminal } from "lucide-react";
import { playSound } from "@/lib/sounds";

// Custom JARVIS-themed dark theme for Prism
const jarvisTheme: Record<string, React.CSSProperties> = {
  'pre[class*="language-"]': {
    background: "oklch(0.12 0.03 250)",
    color: "oklch(0.85 0.19 193)",
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.6875rem",
    lineHeight: "1.6",
    margin: 0,
    padding: "0.75rem 0",
    overflow: "auto",
  },
  'code[class*="language-"]': {
    background: "oklch(0.12 0.03 250)",
    color: "oklch(0.85 0.19 193)",
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.6875rem",
    lineHeight: "1.6",
  },
  comment: { color: "oklch(0.5 0.02 250)" },
  prolog: { color: "oklch(0.5 0.02 250)" },
  doctype: { color: "oklch(0.5 0.02 250)" },
  cdata: { color: "oklch(0.5 0.02 250)" },
  punctuation: { color: "oklch(0.7 0.05 193)" },
  property: { color: "oklch(0.85 0.19 193)" },
  tag: { color: "oklch(0.8 0.16 80)" },
  boolean: { color: "oklch(0.8 0.18 50)" },
  number: { color: "oklch(0.8 0.18 50)" },
  constant: { color: "oklch(0.8 0.18 50)" },
  symbol: { color: "oklch(0.8 0.18 50)" },
  selector: { color: "oklch(0.75 0.15 150)" },
  "attr-name": { color: "oklch(0.75 0.15 150)" },
  string: { color: "oklch(0.75 0.15 150)" },
  char: { color: "oklch(0.75 0.15 150)" },
  builtin: { color: "oklch(0.85 0.15 280)" },
  inserted: { color: "oklch(0.75 0.15 150)" },
  operator: { color: "oklch(0.8 0.16 80)" },
  entity: { color: "oklch(0.8 0.16 80)" },
  url: { color: "oklch(0.85 0.19 193)" },
  atrule: { color: "oklch(0.85 0.15 280)" },
  "attr-value": { color: "oklch(0.75 0.15 150)" },
  keyword: { color: "oklch(0.8 0.16 80)" },
  function: { color: "oklch(0.85 0.15 280)" },
  "class-name": { color: "oklch(0.85 0.15 280)" },
  regex: { color: "oklch(0.75 0.12 60)" },
  important: { color: "oklch(0.8 0.16 80)" },
  variable: { color: "oklch(0.85 0.19 193)" },
  deleted: { color: "oklch(0.7 0.15 25)" },
};

// Language display names
const LANG_NAMES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  jsx: "JSX",
  py: "Python",
  python: "Python",
  rb: "Ruby",
  ruby: "Ruby",
  go: "Go",
  rust: "Rust",
  rs: "Rust",
  java: "Java",
  cpp: "C++",
  c: "C",
  cs: "C#",
  css: "CSS",
  html: "HTML",
  sql: "SQL",
  bash: "Bash",
  shell: "Shell",
  sh: "Shell",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  md: "Markdown",
  markdown: "Markdown",
  xml: "XML",
  dockerfile: "Dockerfile",
  diff: "Diff",
  plaintext: "Text",
  text: "Text",
};

interface CodeBlockProps {
  language: string;
  code: string;
}

export function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const langDisplay = LANG_NAMES[language.toLowerCase()] || language.toUpperCase();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      playSound("click", 0.2);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS contexts
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      playSound("click", 0.2);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-primary/20">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-primary/10 bg-primary/5 px-3 py-1.5">
        <div className="flex items-center gap-2">
          {/* Terminal dots */}
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-400/60" />
            <span className="h-2 w-2 rounded-full bg-amber-400/60" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/60" />
          </div>
          <Terminal className="h-3 w-3 text-primary/40" />
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
            {langDisplay}
          </span>
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-md border border-primary/20 bg-card/80 px-2 py-0.5 font-mono text-[9px] text-muted-foreground/70 transition-colors hover:border-primary/40 hover:text-primary backdrop-blur-sm"
          title={copied ? "Скопировано!" : "Копировать код"}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">OK</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="max-h-[400px] overflow-auto jarvis-scroll">
        <SyntaxHighlighter
          language={language}
          style={jarvisTheme}
          showLineNumbers
          lineNumberStyle={{
            color: "oklch(0.5 0.02 250 / 50%)",
            minWidth: "2.5em",
            fontSize: "0.625rem",
            userSelect: "none",
            paddingRight: "0.75em",
          }}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: "0.6875rem",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

// Shared ReactMarkdown components override for code blocks
export function getMarkdownComponents() {
  return {
    a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a target="_blank" rel="noreferrer" {...props} />
    ),
    code({
      className,
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
      const match = /language-(\w+)/.exec(className || "");
      const codeString = String(children).replace(/\n$/, "");

      if (match) {
        return <CodeBlock language={match[1]} code={codeString} />;
      }

      // Inline code
      return (
        <code
          className="rounded bg-primary/10 px-1 py-0.5 font-mono text-[0.8em] text-primary"
          {...props}
        >
          {children}
        </code>
      );
    },
  };
}