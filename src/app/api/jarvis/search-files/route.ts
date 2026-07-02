import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const BASE_DIR = "/home/z/";
const MAX_DEPTH = 3;
const MAX_RESULTS = 20;

function searchDir(dir: string, query: string, depth: number, results: Array<{ path: string; name: string; size: number; modified: string }>): void {
  if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) break;
    if (entry.name.startsWith(".")) continue;

    const fullPath = path.join(dir, entry.name);

    try {
      if (entry.isDirectory()) {
        searchDir(fullPath, query, depth + 1, results);
      } else {
        if (entry.name.toLowerCase().includes(query.toLowerCase())) {
          const stat = fs.statSync(fullPath);
          results.push({
            path: fullPath,
            name: entry.name,
            size: stat.size,
            modified: stat.mtime.toISOString(),
          });
        }
      }
    } catch {
      /* skip inaccessible */
    }
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ files: [], query: q || "" });
  }

  // Basic path traversal protection
  if (q.includes("..") || q.includes("/")) {
    return NextResponse.json({ files: [], query: q });
  }

  const results: Array<{ path: string; name: string; size: number; modified: string }> = [];

  try {
    searchDir(BASE_DIR, q, 0, results);
  } catch (err: any) {
    console.error("[File Search Error]", err?.message);
  }

  return NextResponse.json({ files: results, query: q });
}