// ─── Notion / Obsidian Note Integration ──────────────────────────────
// Provides sync connectors for reading/writing to Notion API and local
// Obsidian vault, plus a local synced-notes cache in localStorage.

/* ─── Config types ─────────────────────────────────────────────── */

export interface NotionConfig {
  enabled: boolean;
  apiKey: string;
  databaseId?: string;
  parentId?: string;
}

export interface ObsidianConfig {
  enabled: boolean;
  vaultPath?: string;
  syncOnCreate: boolean;
  folder?: string;
}

export interface SyncedNote {
  id: string;
  title: string;
  content: string;
  source: "local" | "notion" | "obsidian";
  externalId?: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
}

/* ─── Notion API helpers (client-side) ─────────────────────────── */

const NOTION_VERSION = "2022-06-28";

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// Minimal shape we care about from Notion page results
interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<
    string,
    {
      type: string;
      title?: Array<{ plain_text: string }>;
      rich_text?: Array<{ plain_text: string }>;
      date?: { start: string };
      multi_select?: Array<{ name: string }>;
    }
  >;
}

export async function fetchNotionPages(config: NotionConfig): Promise<SyncedNote[]> {
  if (!config.apiKey) throw new Error("Notion API key is required");

  const body: Record<string, unknown> = {};
  if (config.databaseId) {
    body.query = "";
    body.filter = { value: "page", property: "object" };
  }

  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: notionHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const pages: NotionPage[] = data.results ?? [];

  return pages.map(pageToSyncedNote);
}

export async function createNotionPage(
  config: NotionConfig,
  title: string,
  content: string,
  tags: string[] = [],
): Promise<SyncedNote> {
  if (!config.apiKey) throw new Error("Notion API key is required");

  const parent: Record<string, string> = config.databaseId
    ? { database_id: config.databaseId }
    : { page_id: config.parentId ?? "" };

  const res = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: notionHeaders(config.apiKey),
    body: JSON.stringify({
      parent,
      properties: {
        title: {
          title: [{ text: { content: title } }],
        },
        ...(tags.length > 0
          ? { Tags: { multi_select: tags.map((t) => ({ name: t })) } }
          : {}),
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content } }],
          },
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion create error ${res.status}: ${err}`);
  }

  const page = (await res.json()) as NotionPage;
  return pageToSyncedNote(page);
}

export async function searchNotion(
  config: NotionConfig,
  query: string,
): Promise<SyncedNote[]> {
  if (!config.apiKey) throw new Error("Notion API key is required");

  const body: Record<string, unknown> = {
    query,
    filter: { value: "page", property: "object" },
  };

  const res = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: notionHeaders(config.apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion search error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return (data.results ?? []).map(pageToSyncedNote);
}

/* ─── Internal: Notion page → SyncedNote ───────────────────────── */

function pageToSyncedNote(page: NotionPage): SyncedNote {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === "title" && p.title?.length,
  );
  const title = titleProp?.title?.map((t) => t.plain_text).join(" ") ?? "Untitled";

  const tagsProp = Object.values(page.properties).find(
    (p) => p.type === "multi_select" && p.multi_select,
  );
  const tags = tagsProp?.multi_select?.map((s) => s.name) ?? [];

  return {
    id: `notion-${page.id}`,
    title,
    content: "",
    source: "notion",
    externalId: page.id,
    tags,
    updatedAt: page.last_edited_time,
    createdAt: page.created_time,
  };
}

/* ─── Obsidian stubs (Electron fs access) ──────────────────────── */

export async function readObsidianNote(
  _config: ObsidianConfig,
  _filePath: string,
): Promise<SyncedNote | null> {
  // Stub — in Electron, use window.electron.fs.readFile
  console.warn("readObsidianNote: Electron-only, not available in browser");
  return null;
}

export async function writeObsidianNote(
  _config: ObsidianConfig,
  _note: SyncedNote,
): Promise<string | null> {
  // Stub — in Electron, use window.electron.fs.writeFile
  console.warn("writeObsidianNote: Electron-only, not available in browser");
  return null;
}

/* ─── Obsidian format export ───────────────────────────────────── */

export function exportToObsidianFormat(note: SyncedNote): string {
  const frontmatter = [
    "---",
    `title: "${note.title.replace(/"/g, '\\"')}"`,
    `source: ${note.source}`,
    `created: ${note.createdAt}`,
    `updated: ${note.updatedAt}`,
    ...(note.tags.length > 0 ? [`tags: [${note.tags.map((t) => `"${t}"`).join(", ")}]`] : []),
    ...(note.externalId ? [`external_id: "${note.externalId}"`] : []),
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${note.content}`;
}

/* ─── Local storage persistence ────────────────────────────────── */

const LS_NOTION = "jarvis-notion-config";
const LS_OBSIDIAN = "jarvis-obsidian-config";
const LS_SYNCED = "jarvis-synced-notes";

export function getNotionConfig(): NotionConfig {
  if (typeof window === "undefined")
    return { enabled: false, apiKey: "" };
  try {
    const raw = localStorage.getItem(LS_NOTION);
    return raw ? { ...{ enabled: false, apiKey: "" }, ...JSON.parse(raw) } : { enabled: false, apiKey: "" };
  } catch {
    return { enabled: false, apiKey: "" };
  }
}

export function saveNotionConfig(cfg: NotionConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_NOTION, JSON.stringify(cfg));
}

export function getObsidianConfig(): ObsidianConfig {
  if (typeof window === "undefined")
    return { enabled: false, syncOnCreate: false };
  try {
    const raw = localStorage.getItem(LS_OBSIDIAN);
    return raw
      ? { ...{ enabled: false, syncOnCreate: false }, ...JSON.parse(raw) }
      : { enabled: false, syncOnCreate: false };
  } catch {
    return { enabled: false, syncOnCreate: false };
  }
}

export function saveObsidianConfig(cfg: ObsidianConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_OBSIDIAN, JSON.stringify(cfg));
}

export function getSyncedNotes(): SyncedNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_SYNCED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSyncedNote(note: SyncedNote): void {
  if (typeof window === "undefined") return;
  const notes = getSyncedNotes();
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    notes[idx] = note;
  } else {
    notes.unshift(note);
  }
  localStorage.setItem(LS_SYNCED, JSON.stringify(notes));
}

export function deleteSyncedNote(id: string): void {
  if (typeof window === "undefined") return;
  const notes = getSyncedNotes().filter((n) => n.id !== id);
  localStorage.setItem(LS_SYNCED, JSON.stringify(notes));
}

/* ─── Sync from Notion into local cache ────────────────────────── */

export async function syncNotesFromNotion(
  config: NotionConfig,
): Promise<SyncedNote[]> {
  const remote = await fetchNotionPages(config);
  for (const note of remote) {
    addSyncedNote(note);
  }
  return getSyncedNotes();
}