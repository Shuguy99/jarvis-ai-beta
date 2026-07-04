import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { searchFTS5, ensureFTS5 } from "@/lib/rag-fts5";

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

// ─── Search (FTS5 BM25 — O(log n) indexed) ─────────────────────

async function handleSearch(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim();
  const limit = parseInt(url.searchParams.get("limit") ?? "10", 10);

  if (!query) {
    return NextResponse.json({ error: "Missing query param" }, { status: 400 });
  }

  // Ensure FTS5 table exists
  await ensureFTS5();

  const results = await searchFTS5(query, limit);

  return NextResponse.json({
    results: results.map((r) => ({
      documentId: r.documentId,
      filename: r.filename,
      chunkIndex: r.chunkIndex,
      content: r.content.slice(0, 500),
      score: -r.rank, // Convert BM25 (lower=better) to score (higher=better)
    })),
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