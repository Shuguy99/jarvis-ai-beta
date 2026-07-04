import { json } from "@/lib/json-response";
import { stat, readdir } from "fs/promises";
import path from "path";

const BASE_DIR = "/home/z";
const MAX_ENTRIES = 50;

interface FileEntry {
  name: string;
  type: "file" | "dir";
  size: number;
  modified: string;
  ext: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawPath = url.searchParams.get("path") ?? "/home/z/my-project";

  const resolved = path.resolve(rawPath);

  if (!resolved.startsWith(BASE_DIR + path.sep) && resolved !== BASE_DIR) {
    return json(
      { error: "Доступ запрещён: путь вне базовой директории" },
      403
    );
  }

  try {
    const dirStat = await stat(resolved);
    if (!dirStat.isDirectory()) {
      return json(
        { error: "Указанный путь не является директорией" },
        400
      );
    }
  } catch {
    return json(
      { error: "Директория не найдена" },
      404
    );
  }

  let entries: FileEntry[];
  try {
    const items = await readdir(resolved, { withFileTypes: true });

    entries = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(resolved, item.name);
        let size = 0;
        let modified = "";

        try {
          const s = await stat(fullPath);
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
      })
    );

    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    entries = entries.slice(0, MAX_ENTRIES);
  } catch {
    return json(
      { error: "Ошибка чтения директории" },
      500
    );
  }

  return json({
    path: resolved,
    files: entries,
  });
}