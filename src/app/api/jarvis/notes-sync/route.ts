import { json } from "@/lib/json-response";

/* ─── Types ────────────────────────────────────────────────────── */

interface SyncedNote {
  id: string;
  title: string;
  content: string;
  source: "local" | "notion" | "obsidian";
  externalId?: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
}

interface SyncRequestBody {
  action: "sync_notion" | "sync_obsidian" | "create_notion";
  apiKey?: string;
  databaseId?: string;
  parentId?: string;
  title?: string;
  content?: string;
  tags?: string[];
  query?: string;
}

/* ─── Notion API helpers (server-side) ─────────────────────────── */

const NOTION_VERSION = "2022-06-28";

function notionHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

interface NotionPage {
  id: string;
  created_time: string;
  last_edited_time: string;
  properties: Record<
    string,
    {
      type: string;
      title?: Array<{ plain_text: string }>;
      multi_select?: Array<{ name: string }>;
    }
  >;
}

function pageToNote(page: NotionPage): SyncedNote {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === "title" && p.title?.length,
  );
  const title =
    titleProp?.title?.map((t) => t.plain_text).join(" ") ?? "Untitled";
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

/* ─── GET: list synced notes ───────────────────────────────────── */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // Server-side route doesn't have localStorage; return empty unless source=notion
    // with an API key provided via query param (dev convenience).
    const source = searchParams.get("source");
    const apiKey = searchParams.get("apiKey");

    if (source === "notion" && apiKey) {
      const res = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: notionHeaders(apiKey),
        body: JSON.stringify({ filter: { value: "page", property: "object" } }),
      });
      if (!res.ok) {
        const err = await res.text();
        return json({ error: `Notion API ${res.status}: ${err}` }, 502);
      }
      const data = await res.json();
      const notes = (data.results ?? []).map(pageToNote);
      return json({ notes });
    }

    // No server-side cache — inform client to use localStorage
    return json({ notes: [], message: "Use localStorage for synced notes cache" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
}

/* ─── POST: actions ────────────────────────────────────────────── */

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SyncRequestBody;
    const { action } = body;

    switch (action) {
      /* ── Sync from Notion ────────────────────────────────────── */
      case "sync_notion": {
        if (!body.apiKey) {
          return json({ error: "apiKey is required" }, 400);
        }
        const res = await fetch("https://api.notion.com/v1/search", {
          method: "POST",
          headers: notionHeaders(body.apiKey),
          body: JSON.stringify({
            ...(body.databaseId
              ? { filter: { value: "page", property: "object" } }
              : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          return json({ error: `Notion API ${res.status}: ${err}` }, 502);
        }
        const data = await res.json();
        const notes = (data.results ?? []).map(pageToNote);
        return json({ notes, synced: notes.length });
      }

      /* ── Create Notion page ──────────────────────────────────── */
      case "create_notion": {
        if (!body.apiKey) {
          return json({ error: "apiKey is required" }, 400);
        }
        if (!body.title) {
          return json({ error: "title is required" }, 400);
        }
        const parent: Record<string, string> = body.databaseId
          ? { database_id: body.databaseId }
          : { page_id: body.parentId ?? "" };

        const res = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: notionHeaders(body.apiKey),
          body: JSON.stringify({
            parent,
            properties: {
              title: {
                title: [{ text: { content: body.title } }],
              },
              ...(body.tags && body.tags.length > 0
                ? {
                    Tags: {
                      multi_select: body.tags.map((t) => ({ name: t })),
                    },
                  }
                : {}),
            },
            children: [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [
                    { type: "text", text: { content: body.content ?? "" } },
                  ],
                },
              },
            ],
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          return json({ error: `Notion API ${res.status}: ${err}` }, 502);
        }
        const page = (await res.json()) as NotionPage;
        const note = pageToNote(page);
        return json({ note, created: true });
      }

      /* ── Obsidian sync (server-side stub) ────────────────────── */
      case "sync_obsidian": {
        return json({
          notes: [],
          message:
            "Obsidian sync requires Electron. Web mode is client-side only.",
        });
      }

      default: {
        return json({ error: `Unknown action: ${action}` }, 400);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
}