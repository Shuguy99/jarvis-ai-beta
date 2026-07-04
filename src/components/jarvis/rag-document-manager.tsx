"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  Search,
  X,
  Loader2,
  FileUp,
  Database,
  CheckCircle,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────

interface DocumentInfo {
  id: string;
  filename: string;
  uploadedAt: string;
  chunkCount: number;
}

interface SearchResult {
  documentId: string;
  filename: string;
  chunkIndex: number;
  content: string;
  score: number;
}

// ─── Component ──────────────────────────────────────────────────

export function RagDocumentManager() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/jarvis/rag");
      const data = await res.json();
      setDocuments(data.documents ?? []);
      setError(null);
    } catch {
      setError("Не удалось загрузить документы");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = "";

    setUploading(true);
    setSuccess(null);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/jarvis/rag", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setSuccess(`${data.filename} — ${data.chunkCount} чанков (${data.totalChars} символов)`);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }, [loadDocuments]);

  const handleDelete = useCallback(async (docId: string) => {
    try {
      const res = await fetch(`/api/jarvis/rag?documentId=${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      setError("Не удалось удалить");
    }
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/jarvis/rag?action=search&query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setError("Ошибка поиска");
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,.json,.csv,.xml,.yaml,.yml,.ts,.tsx,.js,.py,.rs,.go"
          onChange={handleUpload}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="jarvis-box-glow flex items-center gap-2 rounded-lg border jarvis-border-cyan bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-primary transition hover:bg-primary/20 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? "Загрузка..." : "Загрузить документ"}
        </button>
        <button
          onClick={loadDocuments}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border jarvis-border-cyan/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:text-foreground hover:border-primary/30"
        >
          <Database className="h-3 w-3" />
          {loading ? "..." : "Обновить"}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-[9px] text-red-400">
          <X className="h-3 w-3" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 font-mono text-[9px] text-emerald-400">
          <CheckCircle className="h-3 w-3" /> {success}
          <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400/60 hover:text-emerald-400">✕</button>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Поиск по документам..."
            className="w-full rounded-lg border jarvis-border-cyan/30 bg-muted/20 py-2 pl-8 pr-3 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          className="rounded-lg border jarvis-border-cyan/30 bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase text-primary transition hover:bg-primary/20 disabled:opacity-50"
        >
          {searching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Искать"}
        </button>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            Результаты ({searchResults.length})
          </div>
          {searchResults.map((r, i) => (
            <div key={i} className="rounded-lg border jarvis-border-cyan/20 bg-muted/10 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[9px] text-muted-foreground/60">
                  {r.filename} — chunk #{r.chunkIndex}
                </span>
                <span className="font-mono text-[8px] text-primary">score: {r.score.toFixed(1)}</span>
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-foreground/80 line-clamp-4">
                {r.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Document list */}
      <div className="space-y-1.5">
        <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
          Загруженные документы ({documents.length})
        </div>
        {documents.length === 0 && !loading && (
          <div className="rounded-lg border border-dashed jarvis-border-cyan/20 py-6 text-center">
            <FileUp className="mx-auto mb-2 h-6 w-6 text-muted-foreground/30" />
            <p className="font-mono text-[10px] text-muted-foreground/40">Нет загруженных документов</p>
          </div>
        )}
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center justify-between rounded-lg border jarvis-border-cyan/20 bg-muted/10 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <FileText className="h-3.5 w-3.5 text-primary/60" />
              <div>
                <div className="font-mono text-[10px] text-foreground/90">{doc.filename}</div>
                <div className="font-mono text-[8px] text-muted-foreground/50">
                  {doc.chunkCount} чанков — {new Date(doc.uploadedAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDelete(doc.id)}
              className="rounded p-1 text-muted-foreground/40 transition hover:bg-red-500/10 hover:text-red-400"
              title="Удалить"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}