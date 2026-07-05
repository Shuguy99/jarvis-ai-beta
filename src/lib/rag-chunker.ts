/**
 * RAG Text Chunker
 *
 * Splits text into overlapping chunks for retrieval-augmented generation.
 * Strategy: split by paragraphs first, then by sentences if a paragraph
 * exceeds maxChunkSize. Overlap is preserved between consecutive chunks.
 */

/** Split text into chunks with overlap */
export function chunkText(
  text: string,
  maxChunkSize = 500,
  overlap = 50,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // If the entire text fits, return as single chunk
  if (trimmed.length <= maxChunkSize) return [trimmed];

  // Split into paragraphs (separated by one or more blank lines)
  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return [trimmed];

  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChunkSize) {
      // Paragraph fits in a chunk — add directly
      maybeMergeOrPush(chunks, para, maxChunkSize);
    } else {
      // Paragraph too large — split by sentences
      const sentences = splitSentences(para);
      const subChunks = assembleChunks(sentences, maxChunkSize, overlap);
      for (const sc of subChunks) {
        maybeMergeOrPush(chunks, sc, maxChunkSize);
      }
    }
  }

  return chunks;
}

/**
 * Try to merge a chunk with the last one if combined size <= maxChunkSize.
 * Otherwise push as a new chunk.
 */
function maybeMergeOrPush(chunks: string[], text: string, maxChunkSize: number): void {
  if (chunks.length > 0) {
    const last = chunks[chunks.length - 1]!;
    const combined = last + "\n\n" + text;
    if (combined.length <= maxChunkSize) {
      chunks[chunks.length - 1] = combined;
      return;
    }
  }
  chunks.push(text);
}

/** Split text into sentences, keeping the delimiter with the sentence */
function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace or end-of-string
  const raw = text.split(/(?<=[.!?])\s+/);
  return raw.map((s) => s.trim()).filter(Boolean);
}

/**
 * Assemble sentences into chunks respecting maxChunkSize and overlap.
 * Sentences are grouped until adding the next would exceed maxChunkSize.
 * Overlap is achieved by repeating the last few sentences from the previous chunk.
 */
function assembleChunks(
  sentences: string[],
  maxChunkSize: number,
  overlap: number,
): string[] {
  if (sentences.length === 0) return [];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  const flush = (): void => {
    if (current.length === 0) return;
    chunks.push(current.join(" "));
  };

  for (const sentence of sentences) {
    const nextLen = currentLen + (currentLen > 0 ? 1 : 0) + sentence.length;

    if (nextLen > maxChunkSize && current.length > 0) {
      flush();

      // Build overlap: take sentences from the end of the previous chunk
      // until we exceed the overlap budget
      if (overlap > 0 && chunks.length > 0) {
        const prevText = chunks[chunks.length - 1]!;
        const prevSentences = splitSentences(prevText);
        const overlapSentences: string[] = [];
        let overlapLen = 0;
        for (let i = prevSentences.length - 1; i >= 0; i--) {
          const s = prevSentences[i]!;
          if (overlapLen + s.length > overlap) break;
          overlapSentences.unshift(s);
          overlapLen += s.length + 1;
        }
        current = [...overlapSentences];
        currentLen = overlapLen;
      } else {
        current = [];
        currentLen = 0;
      }
    }

    current.push(sentence);
    currentLen += (currentLen > 0 ? 1 : 0) + sentence.length;
  }

  flush();
  return chunks;
}