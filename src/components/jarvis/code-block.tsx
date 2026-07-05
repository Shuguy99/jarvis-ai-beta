

import { useState, useCallback, useEffect } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { playSound } from "@/lib/sounds";

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

function CodeHighlighter({ language, children, style }: { language: string; children: string; style: React.CSSProperties }) {
  const [Highlighter, setHighlighter] = useState<React.ComponentType<any> | null>(null);
  const [theme, setTheme] = useState<Record<string, React.CSSProperties> | null>(null);

  useEffect(() => {
    import("react-syntax-highlighter/dist/esm/prism").then((mod: any) => {
      setHighlighter(() => mod.Prism);
    });
    import("react-syntax-highlighter/dist/esm/styles/prism").then(mod => {
      setTheme(mod.oneDark);
    });
  }, []);

  if (!Highlighter || !theme) {
    return (
      <pre style={{ background: "#282c34", color: "#abb2bf", padding: "1rem", borderRadius: "0.5rem", overflow: "auto", fontSize: "0.85rem", ...style }}>
        <code>{children}</code>
      </pre>
    );
  }

  return (
    <Highlighter language={language} style={theme} customStyle={{ background: "transparent", fontSize: "0.85rem" }}>
      {children}
    </Highlighter>
  );
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
        <CodeHighlighter language={language} style={{ margin: 0, borderRadius: 0, fontSize: "0.6875rem" }}>
          {code}
        </CodeHighlighter>
      </div>
    </div>
  );
}

// Shared ReactMarkdown components override for code blocks
export function getMarkdownComponents() {
  return {
    a: ({ ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a target="_blank" rel="noreferrer noopener" {...props} />
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