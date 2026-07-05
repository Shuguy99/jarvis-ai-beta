/**
 * Client-Side RAG Store — IndexedDB + TF-IDF Vectorization
 *
 * Stores documents and chunks in IndexedDB ('jarvis-rag' database).
 * Uses simplified TF-IDF vectors for cosine-similarity search.
 * All operations are browser-only (no server round-trip).
 */

import { chunkText } from "./rag-chunker";

// ── Types ──────────────────────────────────────────────────────

export interface RAGDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  chunkCount: number;
  createdAt: string;
}

export interface RAGChunk {
  id: string;
  documentId: string;
  text: string;
  vector: string; // JSON-serialized Map<string, number> (sparse TF-IDF)
  index: number;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  text: string;
  score: number;
}

// ── IDB helpers ────────────────────────────────────────────────

const DB_NAME = "jarvis-rag";
const DB_VERSION = 1;
const DOC_STORE = "documents";
const CHUNK_STORE = "chunks";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DOC_STORE)) {
        db.createObjectStore(DOC_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: "id" });
        chunkStore.createIndex("documentId", "documentId", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (stores: Record<string, IDBObjectStore>) => IDBRequest<T> | IDBRequest<T>[],
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const storeNames = [DOC_STORE, CHUNK_STORE];
        const transaction = db.transaction(storeNames, mode);
        const stores: Record<string, IDBObjectStore> = {};
        for (const name of storeNames) {
          stores[name] = transaction.objectStore(name);
        }
        const req = fn(stores);
        // Handle single request or array
        const waitFor = Array.isArray(req) ? req : [req];
        const results: T[] = [];
        let settled = 0;
        for (const r of waitFor) {
          r.onsuccess = () => {
            results.push(r.result as T);
            settled++;
            if (settled === waitFor.length) {
              resolve(Array.isArray(req) ? (results as unknown as T) : (results[0] as T));
            }
          };
          r.onerror = () => reject(r.error);
        }
      }),
  );
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Stop words (English) ───────────────────────────────────────

const EN_STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "am", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "this",
  "that", "these", "those", "it", "its", "i", "you", "he", "she", "we",
  "they", "me", "him", "her", "us", "them", "my", "your", "his", "our",
  "their", "what", "which", "who", "whom", "how", "when", "where", "why",
  "not", "no", "nor", "if", "then", "than", "so", "as", "up", "out",
  "about", "into", "over", "after", "before", "between", "under", "again",
  "there", "here", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "only", "own", "same", "too", "very", "just",
  "because", "through", "during", "while", "also",
]);

/** Detect if text contains CJK or Cyrillic characters */
function isCJKOrCyrillic(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  // CJK Unified Ideographs
  if (code >= 0x4e00 && code <= 0x9fff) return true;
  // CJK Extension A
  if (code >= 0x3400 && code <= 0x4dbf) return true;
  // Hiragana + Katakana
  if (code >= 0x3040 && code <= 0x30ff) return true;
  // Cyrillic
  if (code >= 0x0400 && code <= 0x04ff) return true;
  return false;
}

/** Check if a string has any CJK or Cyrillic characters */
function hasNonLatinText(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (isCJKOrCyrillic(text[i]!)) return true;
  }
  return false;
}

/** Tokenize text into terms */
export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const keepAll = hasNonLatinText(lower);

  // Split on non-alphanumeric (keep CJK/Cyrillic as individual chars)
  const raw = lower.split(/[^a-zа-яё0-9\u4e00-\u9fff\u3040-\u30ff\u3400-\u4dbf]+/);

  if (keepAll) {
    return raw.filter(Boolean);
  }

  return raw.filter((t) => t.length > 1 && !EN_STOP_WORDS.has(t));
}

// ── TF-IDF Vectorization ───────────────────────────────────────

/** Build term → IDF weight map from a corpus of token arrays */
function buildIDF(corpus: string[][]): Map<string, number> {
  const docFreq = new Map<string, number>();
  const n = corpus.length;
  if (n === 0) return new Map();

  for (const tokens of corpus) {
    const seen = new Set(tokens);
    for (const term of seen) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((n + 1) / (df + 1)) + 1);
  }
  return idf;
}

/** Build a TF-IDF sparse vector for a single document */
function tfidfVector(
  tokens: string[],
  idf: Map<string, number>,
): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }

  const maxTf = Math.max(...tf.values(), 1);
  const vec = new Map<string, number>();

  for (const [term, count] of tf) {
    const normalizedTf = 0.5 + 0.5 * (count / maxTf);
    const idfVal = idf.get(term) ?? 1;
    vec.set(term, normalizedTf * idfVal);
  }

  return vec;
}

/** Serialize a sparse vector to JSON string */
function serializeVector(vec: Map<string, number>): string {
  const obj: Record<string, number> = {};
  for (const [k, v] of vec) obj[k] = v;
  return JSON.stringify(obj);
}

/** Deserialize a JSON string to sparse vector */
function deserializeVector(json: string): Map<string, number> {
  const obj = JSON.parse(json) as Record<string, number>;
  return new Map(Object.entries(obj));
}

/** Cosine similarity between two sparse vectors */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;

  // Iterate over the smaller vector for efficiency
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];

  for (const [term, val] of smaller) {
    magA += val * val;
    const bVal = larger.get(term);
    if (bVal !== undefined) {
      dot += val * bVal;
    }
  }

  for (const val of larger.values()) {
    magB += val * val;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Add a document to the client-side RAG store.
 * Chunks the text, computes TF-IDF vectors, stores everything in IndexedDB.
 */
export async function addDocument(
  name: string,
  text: string,
  type: string,
  size: number,
): Promise<RAGDocument> {
  const docId = uid();
  const chunks = chunkText(text);

  // Tokenize all chunks for IDF computation
  const tokenizedChunks = chunks.map((c) => tokenize(c));
  const idf = buildIDF(tokenizedChunks);

  // Build vectors and chunk records
  const chunkRecords: RAGChunk[] = chunks.map((c, i) => {
    const vec = tfidfVector(tokenizedChunks[i]!, idf);
    return {
      id: uid(),
      documentId: docId,
      text: c,
      vector: serializeVector(vec),
      index: i,
    };
  });

  const doc: RAGDocument = {
    id: docId,
    name,
    type,
    size,
    chunkCount: chunkRecords.length,
    createdAt: new Date().toISOString(),
  };

  await tx("readwrite", (stores) => {
    const putDoc = stores[DOC_STORE].put(doc);
    const putChunks = chunkRecords.map((c) => stores[CHUNK_STORE].put(c));
    return [putDoc, ...putChunks] as IDBRequest<unknown>[];
  });

  return doc;
}

/** Remove a document and all its chunks */
export async function removeDocument(docId: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction([DOC_STORE, CHUNK_STORE], "readwrite");
  const docStore = transaction.objectStore(DOC_STORE);
  const chunkStore = transaction.objectStore(CHUNK_STORE);

  // Delete document
  docStore.delete(docId);

  // Delete all chunks for this document via the index
  const index = chunkStore.index("documentId");
  const cursorReq = index.openCursor(IDBKeyRange.only(docId));

  await new Promise<void>((resolve, reject) => {
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    cursorReq.onerror = () => reject(cursorReq.error);
  });
}

/** Get all documents */
export async function getDocuments(): Promise<RAGDocument[]> {
  return tx<RAGDocument[]>("readonly", (stores) => {
    return stores[DOC_STORE].getAll() as IDBRequest<RAGDocument[]>;
  });
}

/** Get all chunks for a specific document */
export async function getChunks(documentId: string): Promise<RAGChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CHUNK_STORE, "readonly");
    const store = transaction.objectStore(CHUNK_STORE);
    const index = store.index("documentId");
    const req = index.getAll(IDBKeyRange.only(documentId));
    req.onsuccess = () => resolve(req.result as RAGChunk[]);
    req.onerror = () => reject(req.error);
  });
}

/** Get all chunks across all documents */
export async function getAllChunks(): Promise<RAGChunk[]> {
  return tx<RAGChunk[]>("readonly", (stores) => {
    return stores[CHUNK_STORE].getAll() as IDBRequest<RAGChunk[]>;
  });
}

/**
 * Search chunks by query using TF-IDF cosine similarity.
 * Re-computes the query vector against the stored corpus IDF
 * by using all stored chunk vectors.
 */
export async function searchChunks(
  query: string,
  topK = 5,
): Promise<SearchResult[]> {
  const allChunks = await getAllChunks();
  if (allChunks.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  // Deserialize all chunk vectors and re-compute a unified IDF
  // For the query, we use the same IDF as the corpus
  const allVecs = allChunks.map((c) => deserializeVector(c.vector));

  // Build unified IDF from all chunk vectors (term frequency in corpus)
  const docFreq = new Map<string, number>();
  for (const vec of allVecs) {
    for (const term of vec.keys()) {
      docFreq.set(term, (docFreq.get(term) ?? 0) + 1);
    }
  }
  const n = allVecs.length;
  const idf = new Map<string, number>();
  for (const [term, df] of docFreq) {
    idf.set(term, Math.log((n + 1) / (df + 1)) + 1);
  }

  // Build query vector
  const queryVec = tfidfVector(queryTokens, idf);

  // Build document name lookup
  const docs = await getDocuments();
  const docMap = new Map(docs.map((d) => [d.id, d.name]));

  // Score each chunk
  const scored: SearchResult[] = allChunks.map((chunk) => {
    const vec = deserializeVector(chunk.vector);
    const score = cosineSimilarity(queryVec, vec);
    return {
      chunkId: chunk.id,
      documentId: chunk.documentId,
      documentName: docMap.get(chunk.documentId) ?? "unknown",
      chunkIndex: chunk.index,
      text: chunk.text,
      score,
    };
  });

  // Sort by score descending, take top-K
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((r) => r.score > 0);
}

/** Estimate total chunks in the store */
export async function getChunkCount(): Promise<number> {
  return tx<number>("readonly", (stores) => {
    return stores[CHUNK_STORE].count() as IDBRequest<number>;
  });
}

/** Estimate database size in bytes (rough) */
export async function getDBSize(): Promise<number> {
  const docs = await getDocuments();
  const chunks = await getAllChunks();
  let total = 0;
  for (const d of docs) total += d.name.length + d.type.length + 50;
  for (const c of chunks) total += c.text.length + c.vector.length + 50;
  return total;
}

// ── Context Builder (for chat injection) ───────────────────────

/**
 * Build a RAG context string from client-side IndexedDB.
 * Called from the browser before sending a chat message.
 * Returns empty string if no relevant chunks are found.
 */
export async function buildClientRAGContext(
  query: string,
  topK = 5,
): Promise<string> {
  if (!query || query.trim().length < 2) return "";

  const results = await searchChunks(query, topK);
  if (results.length === 0) return "";

  const lines = [
    "Context from documents:",
    ...results.map(
      (r, i) => `[${i + 1}] (${r.documentName}, chunk ${r.chunkIndex + 1}): ${r.text}`,
    ),
    "",
  ];

  return lines.join("\n");
}