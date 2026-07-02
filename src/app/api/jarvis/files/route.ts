import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const BASE_DIR = "/home/z";
const MAX_ENTRIES = 50;

interface FileEntry {
  name: string;
  type: "file" | "dir";
  size: number;
  modified: string;
  ext: string;
}

/**
 * GET /api/jarvis/files?path=/home/z/my-project
 * Lists directory contents with security restrictions.
 */
export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path") ?? "/home/z/my-project";

  // Resolve to absolute path
  const resolved = path.resolve(rawPath);

  // Security: must be under BASE_DIR
  if (!resolved.startsWith(BASE_DIR + path.sep) && resolved !== BASE_DIR) {
    return NextResponse.json(
      { error: "Доступ запрещён: путь вне базовой директории" },
      { status: 403 }
    );
  }

  // Check path exists and is a directory
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: "Указанный путь не является директорией" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Директория не найдена" },
      { status: 404 }
    );
  }

  // Read directory entries
  let entries: FileEntry[];
  try {
    const items = fs.readdirSync(resolved, { withFileTypes: true });

    entries = items.map((item) => {
      const fullPath = path.join(resolved, item.name);
      let size = 0;
      let modified = "";

      try {
        const s = fs.statSync(fullPath);
        size = s.size;
        modified = s.mtime.toISOString();
      } catch {
        // skip stat errors
      }

      return {
        name: item.name,
        type: item.isDirectory() ? "dir" as const : "file" as const,
        size,
        modified,
        ext: item.isDirectory() ? "" : path.extname(item.name).toLowerCase(),
      };
    });

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Limit to MAX_ENTRIES
    entries = entries.slice(0, MAX_ENTRIES);
  } catch {
    return NextResponse.json(
      { error: "Ошибка чтения директории" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path: resolved,
    files: entries,
  });
}