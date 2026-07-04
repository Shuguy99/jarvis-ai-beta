/**
 * RAG Chat Integration — Auto-context injection
 *
 * Automatically retrieves relevant document chunks from the RAG
 * database and injects them as system context when the user's
 * query seems to reference uploaded documents.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface RAGContext {
  hasContext: boolean;
  injectedChunks: number;
  contextText: string;
  sources: Array<{ documentId: string; filename: string; chunkIndex: number }>;
}

/**
 * Build RAG context for a chat query.
 * Returns context text to inject into the system prompt and metadata.
 */
export async function buildRAGContext(query: string, maxChunks = 5): Promise<RAGContext> {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  if (queryWords.length === 0) {
    return { hasContext: false, injectedChunks: 0, contextText: "", sources: [] };
  }

  // Score all chunks against query
  const allChunks = await prisma.chunk.findMany({
    include: { document: { select: { filename: true } } },
  });

  const scored = allChunks
    .map((chunk) => {
      const lower = chunk.content.toLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (lower.includes(word)) score += 2;
      }
      // Bonus for multiple words matching in same chunk
      if (score > 0) score += Math.min(score * 0.5, 5);
      return { chunk, score };
    })
    .filter((r) => r.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxChunks);

  if (scored.length === 0) {
    return { hasContext: false, injectedChunks: 0, contextText: "", sources: [] };
  }

  const sources = scored.map((r) => ({
    documentId: r.chunk.documentId,
    filename: r.chunk.document.filename,
    chunkIndex: r.chunk.index,
  }));

  const contextText = [
    "РЕЛЕВАНТНЫЕ ДОКУМЕНТЫ (из загруженных файлов):",
    "",
    ...scored.map(
      (r, i) =>
        `[Документ: ${r.chunk.document.filename}, фрагмент ${r.chunk.index + 1}]\n${r.chunk.content}`
    ),
    "",
    "Используй эту информацию для ответа. Если информации недостаточно, скажи об этом.",
  ].join("\n");

  return {
    hasContext: true,
    injectedChunks: scored.length,
    contextText,
    sources,
  };
}

/**
 * Inject RAG context into existing system prompt.
 * Appends context if relevant chunks are found.
 */
export async function injectRAGIntoSystemPrompt(
  systemPrompt: string,
  query: string
): Promise<{ prompt: string; context: RAGContext }> {
  const context = await buildRAGContext(query);

  if (!context.hasContext) {
    return { prompt: systemPrompt, context };
  }

  return {
    prompt: `${systemPrompt}\n\n${context.contextText}`,
    context,
  };
}