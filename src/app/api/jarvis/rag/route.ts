import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const prisma = new PrismaClient();

const UPLOAD_DIR = process.env.RAG_UPLOAD_DIR || "/tmp/jarvis-rag";
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/jarvis/rag
 * Upload a text file for RAG. Persists document + chunks to SQLite.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided. Use 'file' field." }, { status: 400 });
    }

    const allowedTypes = [
      "text/plain", "text/markdown", "text/csv",
      "application/json", "application/xml", "text/x-markdown",
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(md|txt|json|csv|xml|yaml|yml|ts|tsx|js|py|rs|go)$/i)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Only text files allowed.` },
        { status: 400 }
      );
    }

    await ensureDir();

    const text = await file.text();
    if (text.trim().length < 10) {
      return NextResponse.json({ error: "File is empty or too short." }, { status: 400 });
    }

    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

    // Persist to database
    const doc = await prisma.document.create({
      data: {
        filename: file.name,
        chunks: {
          create: chunks.map((content, index) => ({ content, index })),
        },
      },
      include: { chunks: true },
    });

    return NextResponse.json({
      documentId: doc.id,
      filename: doc.filename,
      chunkCount: doc.chunks.length,
      totalChars: text.length,
    });
  } catch (error) {
    console.error("RAG upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/**
 * GET /api/jarvis/rag
 * List uploaded documents.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // Search mode: GET /api/jarvis/rag?action=search&query=xxx
  if (action === "search") {
    return handleSearch(req);
  }

  // List mode: GET /api/jarvis/rag
  const docs = await prisma.document.findMany({
    orderBy: { uploadedAt: "desc" },
    include: { chunks: { select: { id: true } } },
  });

  return NextResponse.json({
    documents: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      uploadedAt: d.uploadedAt,
      chunkCount: d.chunks.length,
    })),
  });
}

/**
 * DELETE /api/jarvis/rag?documentId=xxx
 * Delete a document and all its chunks (cascade).
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const docId = url.searchParams.get("documentId");

  if (!docId) {
    return NextResponse.json({ error: "Missing documentId query param" }, { status: 400 });
  }

  try {
    const deleted = await prisma.document.delete({ where: { id: docId } });
    return NextResponse.json({ success: true, documentId: deleted.id });
  } catch {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
}

// ─── Search ──────────────────────────────────────────────────────

async function handleSearch(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim();
  const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);

  if (!query) {
    return NextResponse.json({ error: "Missing query param" }, { status: 400 });
  }

  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(Boolean);

  // Fetch all chunks and score in-memory (SQLite FTS not yet configured)
  const allChunks = await prisma.chunk.findMany({
    include: { document: { select: { filename: true } } },
  });

  const results = allChunks
    .map((chunk) => {
      const lowerContent = chunk.content.toLowerCase();
      // Score: count matching words, boost exact substring match
      let score = 0;
      for (const word of queryWords) {
        const idx = lowerContent.indexOf(word);
        if (idx !== -1) {
          score += 10 - Math.floor(idx / 200);
        }
      }
      return {
        documentId: chunk.documentId,
        filename: chunk.document.filename,
        chunkIndex: chunk.index,
        content: chunk.content.slice(0, 500),
        score,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return NextResponse.json({
    results,
    query,
    totalFound: results.length,
  });
}

// ─── Text Chunking ──────────────────────────────────────────────

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (text.length <= chunkSize) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Break at paragraph or line boundary
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