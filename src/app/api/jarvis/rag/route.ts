import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Simple nanoid implementation (no dependency needed)
function nanoid(size = 21): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36)).join("");
}

const UPLOAD_DIR = process.env.RAG_UPLOAD_DIR || "/tmp/jarvis-rag";
const CHUNK_SIZE = 500; // chars per chunk
const CHUNK_OVERLAP = 100; // chars overlap between chunks

// In-memory document store (in production, use a vector DB)
interface Document {
  id: string;
  filename: string;
  uploadedAt: string;
  chunks: Chunk[];
}

interface Chunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
}

const documents = new Map<string, Document>();

/** Ensure upload directory exists */
async function ensureDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

/**
 * POST /api/jarvis/rag/upload
 * Upload a text/markdown file for RAG.
 * Body: FormData with "file" field.
 * Returns: { documentId, filename, chunkCount }
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided. Use 'file' field." }, { status: 400 });
    }

    // Only allow text-based files
    const allowedTypes = [
      "text/plain", "text/markdown", "text/csv",
      "application/json", "application/xml",
      "text/x-markdown",
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

    // Simple chunking: split by paragraphs/sentences, respect overlap
    const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);
    const docId = nanoid(10);

    const doc: Document = {
      id: docId,
      filename: file.name,
      uploadedAt: new Date().toISOString(),
      chunks: chunks.map((content, index) => ({
        id: nanoid(10),
        documentId: docId,
        content,
        index,
      })),
    };

    documents.set(docId, doc);

    return NextResponse.json({
      documentId: docId,
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
 * GET /api/jarvis/documents
 * List uploaded documents.
 */
export async function GET() {
  const docs = Array.from(documents.values()).map(({ id, filename, uploadedAt, chunks }) => ({
    id,
    filename,
    uploadedAt,
    chunkCount: chunks.length,
  }));

  return NextResponse.json({ documents: docs });
}

/**
 * DELETE /api/jarvis/documents?documentId=xxx
 * Delete a document and its chunks.
 */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const docId = url.searchParams.get("documentId");

  if (!docId) {
    return NextResponse.json({ error: "Missing documentId query param" }, { status: 400 });
  }

  const deleted = documents.delete(docId);
  if (!deleted) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true, documentId: docId });
}

/**
 * GET /api/jarvis/rag/search?query=xxx
 * Simple keyword search across all document chunks.
 * Returns: { results: [{ documentId, filename, chunkIndex, content, score }] }
 */
export async function GET_search(req: NextRequest) {
  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim();

  if (!query) {
    return NextResponse.json({ error: "Missing query param" }, { status: 400 });
  }

  const queryLower = query.toLowerCase();
  const results: Array<{
    documentId: string;
    filename: string;
    chunkIndex: number;
    content: string;
    score: number;
  }> = [];

  for (const doc of documents.values()) {
    for (const chunk of doc.chunks) {
      const lowerContent = chunk.content.toLowerCase();
      const idx = lowerContent.indexOf(queryLower);
      if (idx === -1) continue;

      // Score: higher for exact match, shorter chunks, early position
      const score = 10 - Math.floor(idx / 100) - Math.floor(chunk.content.length / 1000);
      results.push({
        documentId: doc.id,
        filename: doc.filename,
        chunkIndex: chunk.index,
        content: chunk.content.slice(Math.max(0, idx - 150), idx + 250).trim(),
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    results: results.slice(0, 10),
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

    // Try to break at a paragraph boundary
    if (end < text.length) {
      const nextBreak = text.indexOf("\n\n", end - 200);
      if (nextBreak > 0 && nextBreak < end + 200) {
        end = nextBreak + 2;
      } else {
        const nextBreak = text.indexOf("\n", end - 100);
        if (nextBreak > 0 && nextBreak < end + 100) {
          end = nextBreak + 1;
        }
      }
    }

    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}