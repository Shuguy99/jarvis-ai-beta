import { json } from "@/lib/json-response";
import { readdir, stat } from "fs/promises";
import path from "path";

const BASE_DIR = "/home/z/";
const MAX_DEPTH = 3;
const MAX_RESULTS = 20;

async function searchDir(dir: string, query: string, depth: number, results: Array<{ path: string; name: string; size: number; modified: string }>): Promise<void> {
  if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) break;
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);

    try {
      if (entry.isDirectory()) {
        await searchDir(fullPath, query, depth + 1, results);
      } else {
        if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          const s = await stat(fullPath);
          results.push({
            path: fullPath,
            name: entry.name,
            size: s.size,
            modified: s.mtime.toISOString(),
          });
        }
      }
    } catch {
      /* skip inaccessible */
    }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return json({ files: [], query: q || "" });
  }

  if (q.includes("..") || q.includes("/") || q.includes("\\")) {
    return json({ files: [], query: q });
  }

  const results: Array<{ path: string; name: string; size: number; modified: string }> = [];

  try {
    await searchDir(BASE_DIR, q, 0, results);
  } catch (err: unknown) {
    console.error("[File Search Error]", err instanceof Error ? err.message : err);
  }

  return json({ files: results, query: q });
}