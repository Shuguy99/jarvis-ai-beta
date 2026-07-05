import { json } from "@/lib/json-response";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { searchFTS5, ensureFTS5 } from "@/lib/rag-fts5";

const UPLOAD_DIR = process.env.RAG_UPLOAD_DIR || "/tmp/jarvis-rag";
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return json({ error: "No file provided. Use 'file' field." }, 400);
    }

    const allowedTypes = [
      "text/plain", "text/markdown", "text/csv",
      "application/json", "application/xml", "text/x-markdown",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(md|txt|json|csv|xml|yaml|yml|ts|tsx|js|py|rs|go)$/i)) {
      return json(
        { error: `Unsupported file type: ${file.type}. Only text files allowed.` },
        400
      );
    }

    await ensureDir();

    const text = await file.text();
    if (text.trim().length < 10) {
      return json({ error: "File is empty or too short." }, 400);
    }

    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

    const doc = await db.document.create({
      data: {
        filename: file.name,
        chunks: {
          create: chunks.map((content, index) => ({ content, index })),
        },
      },
      include: { chunks: true },
    });

    return json({
      documentId: doc.id,
      filename: doc.filename,
      chunkCount: doc.chunks.length,
      totalChars: text.length,
    });
  } catch (error) {
    console.error("RAG upload error:", error);
    return json({ error: "Upload failed" }, 500);
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "search") {
      return handleSearch(req);
    }

    const docs = await db.document.findMany({
      orderBy: { uploadedAt: "desc" },
      include: { chunks: { select: { id: true } } },
    });

    return json({
      documents: docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        uploadedAt: d.uploadedAt,
        chunkCount: d.chunks.length,
      })),
    });
  } catch (error) {
    console.error("Failed to load RAG documents:", error);
    return json({ error: "Failed to load RAG documents" }, 500);
  }
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const docId = url.searchParams.get("documentId");

  if (!docId) {
    return json({ error: "Missing documentId query param" }, 400);
  }

  try {
    const deleted = await db.document.delete({ where: { id: docId } });
    return json({ success: true, documentId: deleted.id });
  } catch {
    return json({ error: "Document not found" }, 404);
  }
}

async function handleSearch(req: Request) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim();
  const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);

  if (!query) {
    return json({ error: "Missing query param" }, 400);
  }

  await ensureFTS5();

  const results = await searchFTS5(query, limit);

  return json({
    results: results.map((r) => ({
      documentId: r.documentId,
      filename: r.filename,
      chunkIndex: r.chunkIndex,
      content: r.content.slice(0, 500),
      score: -r.rank,
    })),
    query,
    totalFound: results.length,
  });
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    if (end < text.length) {
      const paraBreak = text.indexOf("\n\n", end - 200);
      if (paraBreak > 0 && paraBreak < end + 200) {
        end = paraBreak + 2;
      } else {
        const lineBreak = text.indexOf("\n", end - 100);
        if (lineBreak > 0 && lineBreak < end + 100) {
          end = lineBreak + 1;
        }
      }
    }

    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}