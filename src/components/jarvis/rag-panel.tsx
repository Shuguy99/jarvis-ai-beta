/**
 * RAG Panel — Client-side document management and retrieval UI
 *
 * Drag-and-drop zone for TXT/MD/JSON uploads, document list,
 * search bar with highlighted results, and database stats.
 * All data lives in browser IndexedDB (no server round-trip).
 */

import { useState, useRef, useCallback } from "react";
import {
  FileText,
  Upload,
  Trash2,
  Search,
  Database,
  FileUp,
  X,
  Loader2,
} from "lucide-react";
import { useRAG } from "@/hooks/use-rag";
import type { SearchResult } from "@/lib/rag-store";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Highlight matching terms in text */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (terms.length === 0) return <span>{text}</span>;

  // Build regex that matches any term (case-insensitive)
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="rounded-sm bg-cyan-500/30 text-cyan-200 px-0.5"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

/** Single search result card */
function ResultCard({ result, query }: { result: SearchResult; query: string }) {
  return (
    <div className="rounded-lg border border-cyan-500/20 bg-muted/10 p-3 transition-colors hover:border-cyan-500/40">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="truncate font-mono text-[9px] text-muted-foreground/70">
          <FileText className="mr-1 inline-block h-3 w-3 text-cyan-400/60" />
          {result.documentName} — chunk #{result.chunkIndex + 1}
        </span>
        <span className="shrink-0 font-mono text-[8px] text-cyan-400">
          {result.score.toFixed(3)}
        </span>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-foreground/80 line-clamp-4">
        <HighlightedText text={result.text} query={query} />
      </p>
    </div>
  );
}

export function RAGPanel() {
  const {
    documents,
    uploadDocument,
    removeDocument,
    searchQuery,
    searchResults,
    isUploading,
    isSearching,
    stats,
  } = useRAG();

  const [searchInput, setSearchInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const showMessage = useCallback((type: "ok" | "err", text: string) => {
    setMessage({ type, text });
    const id = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(id);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      for (const file of Array.from(files)) {
        const doc = await uploadDocument(file);
        if (doc) {
          showMessage("ok", `${doc.name} — ${doc.chunkCount} chunks`);
        } else {
          showMessage("err", `Failed to upload ${file.name}. Only TXT/MD/JSON supported.`);
        }
      }
      if (fileRef.current) fileRef.current.value = "";
    },
    [uploadDocument, showMessage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      void handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleSearch = useCallback(() => {
    if (searchInput.trim()) {
      void searchQuery(searchInput);
    }
  }, [searchInput, searchQuery]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Stats Bar ── */}
      <div className="flex items-center gap-4 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
        <span className="flex items-center gap-1.5">
          <Database className="h-3 w-3" />
          {stats.documentCount} docs
        </span>
        <span>{stats.totalChunks} chunks</span>
        {stats.dbSize > 0 && <span>{formatBytes(stats.dbSize)}</span>}
      </div>

      {/* ── Drop Zone ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
          px-4 py-8 transition-colors
          ${dragOver
            ? "border-cyan-400 bg-cyan-500/10"
            : "border-cyan-500/20 bg-muted/5 hover:border-cyan-500/40 hover:bg-muted/10"
          }
        `}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.markdown,.json,.csv,.xml,.yaml,.yml,.ts,.tsx,.js,.py,.rs,.go"
          multiple
          onChange={(e) => void handleFiles(e.target.files)}
          className="hidden"
        />
        {isUploading ? (
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
        ) : (
          <Upload className="h-8 w-8 text-cyan-400/60" />
        )}
        <div className="text-center">
          <p className="font-mono text-[10px] text-foreground/70">
            Drop TXT / MD / JSON files here
          </p>
          <p className="mt-1 font-mono text-[8px] text-muted-foreground/40">
            or click to browse — PDF support coming soon
          </p>
        </div>
      </div>

      {/* ── Status Messages ── */}
      {message && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-[9px]
            ${message.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
              : "border-red-500/30 bg-red-500/5 text-red-400"
            }`}
        >
          <span className="flex-1">{message.text}</span>
          <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Search ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Test retrieval..."
            className="w-full rounded-lg border border-cyan-500/30 bg-muted/20 py-2 pl-8 pr-3 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:border-cyan-500/50 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearching || !searchInput.trim()}
          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 font-mono text-[10px] uppercase text-cyan-400 transition hover:bg-cyan-500/20 disabled:opacity-50"
        >
          {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
        </button>
      </div>

      {/* ── Search Results ── */}
      {searchResults.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            Results ({searchResults.length})
          </div>
          {searchResults.map((r) => (
            <ResultCard key={r.chunkId} result={r} query={searchInput} />
          ))}
        </div>
      )}

      {/* ── Document List ── */}
      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
          Documents ({documents.length})
        </div>
        {documents.length === 0 && (
          <div className="rounded-lg border border-dashed border-cyan-500/20 py-6 text-center">
            <FileUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="font-mono text-[10px] text-muted-foreground/40">
              No documents uploaded yet
            </p>
          </div>
        )}
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between rounded-lg border border-cyan-500/20 bg-muted/10 px-3 py-2 transition-colors hover:border-cyan-500/30"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-400/60" />
              <div className="min-w-0">
                <div className="truncate font-mono text-[10px] text-foreground/90">
                  {doc.name}
                </div>
                <div className="font-mono text-[8px] text-muted-foreground/50">
                  {doc.chunkCount} chunks — {formatBytes(doc.size)} —{" "}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <button
              onClick={() => void removeDocument(doc.id)}
              className="shrink-0 rounded p-1 text-muted-foreground/40 transition hover:bg-red-500/10 hover:text-red-400"
              title="Remove"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}