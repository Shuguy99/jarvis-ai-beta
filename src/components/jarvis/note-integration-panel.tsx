"use client";

// JARVIS Note Integration Panel — Notion & Obsidian sync connectors

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Link,
  FolderOpen,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Check,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { playSound } from "@/lib/sounds";
import {
  type NotionConfig,
  type ObsidianConfig,
  type SyncedNote,
  getNotionConfig,
  saveNotionConfig,
  getObsidianConfig,
  saveObsidianConfig,
  getSyncedNotes,
  addSyncedNote,
  deleteSyncedNote,
  fetchNotionPages,
  createNotionPage,
  searchNotion,
  syncNotesFromNotion,
  exportToObsidianFormat,
} from "@/lib/note-integration";

/* ─── Sub-components ───────────────────────────────────────────── */

function SourceBadge({ source }: { source: SyncedNote["source"] }) {
  const colors: Record<SyncedNote["source"], string> = {
    local: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    notion: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    obsidian: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${colors[source]}`}
    >
      {source}
    </span>
  );
}

/* ─── Notion Tab ───────────────────────────────────────────────── */

function NotionTab() {
  const [config, setConfig] = useState<NotionConfig>({ enabled: false, apiKey: "" });
  const [pages, setPages] = useState<SyncedNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(getNotionConfig());
  }, []);

  const handleSave = () => {
    saveNotionConfig(config);
    setSaved(true);
    playSound("click");
    setTimeout(() => setSaved(false), 1500);
  };

  const handleFetchPages = useCallback(async () => {
    if (!config.apiKey) {
      setError("API key is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await fetchNotionPages(config);
      setPages(result);
      result.forEach(addSyncedNote);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch pages");
    } finally {
      setLoading(false);
    }
  }, [config]);

  const handleSearch = useCallback(async () => {
    if (!config.apiKey || !searchQuery.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await searchNotion(config, searchQuery);
      setPages(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, [config, searchQuery]);

  const handleSync = useCallback(async () => {
    if (!config.apiKey) {
      setError("API key is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const merged = await syncNotesFromNotion(config);
      setPages(merged.filter((n) => n.source === "notion"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  }, [config]);

  return (
    <div className="space-y-4">
      {/* Config inputs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Enabled
          </Label>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            API Key
          </Label>
          <Input
            type="password"
            placeholder="ntn_..."
            value={config.apiKey}
            onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Database ID (optional)
          </Label>
          <Input
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={config.databaseId ?? ""}
            onChange={(e) => setConfig((c) => ({ ...c, databaseId: e.target.value || undefined }))}
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Parent Page ID (optional)
          </Label>
          <Input
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={config.parentId ?? ""}
            onChange={(e) => setConfig((c) => ({ ...c, parentId: e.target.value || undefined }))}
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            className="h-7 gap-1.5 bg-primary/80 font-mono text-[10px] uppercase tracking-wider hover:bg-primary"
          >
            {saved ? <Check className="h-3 w-3" /> : <Link className="h-3 w-3" />}
            {saved ? "Saved" : "Save Config"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFetchPages}
            disabled={loading}
            className="h-7 gap-1.5 font-mono text-[10px] uppercase tracking-wider"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Fetch Pages
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSync}
            disabled={loading}
            className="h-7 gap-1.5 font-mono text-[10px] uppercase tracking-wider"
          >
            Sync All
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search Notion..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="h-7 flex-1 font-mono text-xs"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSearch}
          disabled={loading || !searchQuery.trim()}
          className="h-7 w-7 p-0"
        >
          <Search className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Pages list */}
      {pages.length > 0 && (
        <div className="max-h-52 space-y-1 overflow-y-auto">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            {pages.length} page{pages.length !== 1 ? "s" : ""} found
          </div>
          {pages.map((page) => (
            <div
              key={page.id}
              className="flex items-center justify-between rounded border border-border/50 bg-card/30 px-3 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground/90">
                  {page.title}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60">
                  <SourceBadge source={page.source} />
                  {new Date(page.updatedAt).toLocaleDateString()}
                </div>
              </div>
              {page.externalId && (
                <a
                  href={`https://notion.so/${page.externalId.replace(/-/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-muted-foreground/50 hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Obsidian Tab ─────────────────────────────────────────────── */

function ObsidianTab() {
  const [config, setConfig] = useState<ObsidianConfig>({ enabled: false, syncOnCreate: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(getObsidianConfig());
  }, []);

  const handleSave = () => {
    saveObsidianConfig(config);
    setSaved(true);
    playSound("click");
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-[11px] text-yellow-400/80">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        Obsidian vault access requires Electron. Web mode shows stubs only.
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Enabled
          </Label>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
          />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Vault Path
          </Label>
          <Input
            placeholder="/home/user/Documents/MyVault"
            value={config.vaultPath ?? ""}
            onChange={(e) => setConfig((c) => ({ ...c, vaultPath: e.target.value || undefined }))}
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Default Folder
          </Label>
          <Input
            placeholder="JARVIS"
            value={config.folder ?? ""}
            onChange={(e) => setConfig((c) => ({ ...c, folder: e.target.value || undefined }))}
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Auto-sync on Create
          </Label>
          <Switch
            checked={config.syncOnCreate}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, syncOnCreate: v }))}
          />
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          className="h-7 gap-1.5 bg-primary/80 font-mono text-[10px] uppercase tracking-wider hover:bg-primary"
        >
          {saved ? <Check className="h-3 w-3" /> : <FolderOpen className="h-3 w-3" />}
          {saved ? "Saved" : "Save Config"}
        </Button>
      </div>
    </div>
  );
}

/* ─── Main Panel ───────────────────────────────────────────────── */

export function NoteIntegrationPanel() {
  const [activeTab, setActiveTab] = useState<"notion" | "obsidian" | "synced">("notion");
  const [syncedNotes, setSyncedNotes] = useState<SyncedNote[]>([]);

  useEffect(() => {
    setSyncedNotes(getSyncedNotes());
  }, []);

  const handleDelete = (id: string) => {
    deleteSyncedNote(id);
    setSyncedNotes(getSyncedNotes());
    playSound("click");
  };

  const handleExportObsidian = (note: SyncedNote) => {
    const md = exportToObsidianFormat(note);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.replace(/[^a-zA-Z0-9_\- ]/g, "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    playSound("click");
  };

  const tabs: Array<{ id: "notion" | "obsidian" | "synced"; label: string; icon: React.ReactNode }> = [
    { id: "notion", label: "Notion", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { id: "obsidian", label: "Obsidian", icon: <FolderOpen className="h-3.5 w-3.5" /> },
    { id: "synced", label: "Synced", icon: <RefreshCw className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-dashed jarvis-border-cyan/50 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === "synced") setSyncedNotes(getSyncedNotes());
              playSound("click");
            }}
            className={`flex items-center gap-1.5 rounded-t px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              activeTab === tab.id
                ? "border border-b-0 border-primary/30 bg-primary/10 text-primary"
                : "text-muted-foreground/60 hover:text-foreground/80"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "notion" && <NotionTab />}
      {activeTab === "obsidian" && <ObsidianTab />}

      {activeTab === "synced" && (
        <div className="space-y-2">
          <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
            {syncedNotes.length} synced note{syncedNotes.length !== 1 ? "s" : ""}
          </div>

          {syncedNotes.length === 0 && (
            <div className="py-6 text-center text-[11px] text-muted-foreground/40">
              No synced notes yet. Connect Notion and sync to populate.
            </div>
          )}

          <div className="max-h-64 space-y-1 overflow-y-auto">
            {syncedNotes.map((note) => (
              <div
                key={note.id}
                className="group flex items-center justify-between rounded border border-border/50 bg-card/30 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground/90">
                    {note.title}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground/60">
                    <SourceBadge source={note.source} />
                    <span>{new Date(note.updatedAt).toLocaleDateString()}</span>
                    {note.tags.length > 0 && (
                      <span className="text-muted-foreground/40">
                        {note.tags.slice(0, 3).join(", ")}
                        {note.tags.length > 3 && ` +${note.tags.length - 3}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleExportObsidian(note)}
                    className="rounded p-1 text-muted-foreground/50 hover:bg-primary/10 hover:text-primary"
                    title="Export as Obsidian Markdown"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(note.id)}
                    className="rounded p-1 text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-400"
                    title="Remove from cache"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}