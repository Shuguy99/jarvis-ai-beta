

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Folder,
  Code,
  FileText,
  Image,
  File,
  Home,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";

// ── Types ─────────────────────────────────────────────────────
interface FileEntry {
  name: string;
  type: "file" | "dir";
  size: number;
  modified: string;
  ext: string;
}

interface FilesResponse {
  path: string;
  files: FileEntry[];
}

// ── Helpers ───────────────────────────────────────────────────
const BASE_DIR = "/home/z";
const DEFAULT_PATH = "/home/z/my-project";

function humanSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 5) return "сейчас";
  if (diff < 60) return `${diff}с назад`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ч назад`;
  const days = Math.floor(hrs / 24);
  return `${days}д назад`;
}

function getFileIcon(ext: string) {
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return Code;
  if ([".md", ".txt", ".log", ".csv", ".json", ".yaml", ".yml", ".toml"].includes(ext)) {
    return FileText;
  }
  if ([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp"].includes(ext)) {
    return Image;
  }
  return File;
}

// ── Main component ────────────────────────────────────────────
export function FileExplorerWidget() {
  const [currentPath, setCurrentPath] = useState(DEFAULT_PATH);
  const [data, setData] = useState<FilesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async (targetPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/jarvis/files?path=${encodeURIComponent(targetPath)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Ошибка ${res.status}`);
      }
      const json: FilesResponse = await res.json();
      setData(json);
      setCurrentPath(json.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/jarvis/files?path=${encodeURIComponent(DEFAULT_PATH)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Ошибка ${res.status}`);
        }
        const json: FilesResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setCurrentPath(json.path);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const navigateTo = (targetPath: string) => {
    playSound("click", 0.2);
    setCurrentPath(targetPath);
    void fetchFiles(targetPath);
  };

  const handleHome = () => {
    playSound("click", 0.2);
    navigateTo(DEFAULT_PATH);
  };

  const handleEntryClick = (entry: FileEntry) => {
    playSound("click", 0.2);
    if (entry.type === "dir") {
      navigateTo(`${currentPath}/${entry.name}`);
    } else {
      addActivityEvent({
        message: `Файл: ${entry.name}`,
        severity: "info",
        category: "system",
      });
    }
  };

  // Build breadcrumb segments
  const segments = currentPath.split("/").filter(Boolean);

  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              File Explorer
            </span>
          </div>
          <button
            onClick={handleHome}
            className="flex items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/10"
            aria-label="Домой"
          >
            <Home className="h-3 w-3" />
            <span>Домой</span>
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-0.5 overflow-hidden font-mono text-[10px] text-muted-foreground">
          {segments.map((seg, i) => {
            const segPath = "/" + segments.slice(0, i + 1).join("/");
            const isLast = i === segments.length - 1;
            return (
              <span key={segPath} className="flex items-center gap-0.5 shrink-0">
                {i > 0 && <ChevronRight className="h-2.5 w-2.5 text-primary/40 shrink-0" />}
                {isLast ? (
                  <span className="truncate text-primary/90">{seg}</span>
                ) : (
                  <button
                    onClick={() => navigateTo(segPath)}
                    className="truncate transition-colors hover:text-primary"
                  >
                    {seg}
                  </button>
                )}
              </span>
            );
          })}
        </div>

        {/* Content */}
        {error ? (
          <div className="flex items-center gap-2 rounded-md border border-rose-400/20 bg-rose-400/5 px-3 py-2 font-mono text-[10px] text-rose-400/90">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        ) : loading || !data ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-sm bg-primary/5 px-2 py-1.5"
              >
                <div className="h-3 w-3 animate-pulse rounded-sm bg-primary/10" />
                <div className="h-2.5 flex-1 animate-pulse rounded-sm bg-primary/10" />
                <div className="h-2.5 w-10 animate-pulse rounded-sm bg-primary/10" />
              </div>
            ))}
          </div>
        ) : data.files.length === 0 ? (
          <div className="flex items-center justify-center py-6 font-mono text-[10px] text-muted-foreground">
            Папка пуста
          </div>
        ) : (
          <div className="jarvis-scroll max-h-72 flex-col gap-px overflow-y-auto">
            {data.files.map((entry) => {
              const isDir = entry.type === "dir";
              const Icon = isDir ? Folder : getFileIcon(entry.ext);

              return (
                <button
                  key={entry.name}
                  onClick={() => handleEntryClick(entry)}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition hover:bg-primary/10 ${
                    isDir ? "border-l-2 border-primary/50" : "border-l-2 border-transparent"
                  }`}
                >
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${isDir ? "text-primary" : "text-muted-foreground/70"}`}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80">
                    {entry.name}
                  </span>
                  {!isDir && (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/50">
                      {humanSize(entry.size)}
                    </span>
                  )}
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">
                    {timeAgo(entry.modified)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}