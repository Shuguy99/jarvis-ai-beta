import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";

export const runtime = "nodejs";

const MAX_CHUNK_LENGTH = 1000;

/**
 * Splits text into chunks of at most MAX_CHUNK_LENGTH characters,
 * breaking on sentence boundaries (.!?\n) when possible.
 */
function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_LENGTH) {
      chunks.push(remaining);
      break;
    }

    // Try to find a sentence boundary within the limit
    let splitIdx = -1;
    const searchEnd = Math.min(remaining.length, MAX_CHUNK_LENGTH);

    for (let i = searchEnd - 1; i >= 0; i--) {
      const ch = remaining[i];
      if (ch === "." || ch === "!" || ch === "?" || ch === "\n") {
        splitIdx = i + 1; // include the delimiter
        break;
      }
    }

    // Fallback: split on last space before limit
    if (splitIdx === -1) {
      for (let i = searchEnd - 1; i >= 0; i--) {
        if (remaining[i] === " ") {
          splitIdx = i + 1;
          break;
        }
      }
    }

    // Last resort: hard cut
    if (splitIdx === -1) {
      splitIdx = searchEnd;
    }

    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * POST /api/jarvis/tts
 * Body: { text, voice?, speed?, volume? }
 * Returns: audio/wav binary (concatenated if text was chunked)
 */
export async function POST(req: NextRequest) {
  try {
    const {
      text,
      voice = "kazi",
      speed = 0.92,
      volume = 1.0,
    } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Текст пуст." }, { status: 400 });
    }

    if (typeof volume !== "number" || volume <= 0 || volume > 10) {
      return NextResponse.json(
        { error: "Параметр volume должен быть числом от >0 до 10." },
        { status: 400 }
      );
    }

    const clean = text.replace(/\s+/g, " ").trim();
    const chunks = chunkText(clean);

    const zai = await ZAI.create();

    // Synthesize each chunk and concatenate the WAV buffers
    const wavBuffers: Buffer[] = [];

    for (const chunk of chunks) {
      const response = await zai.audio.tts.create({
        input: chunk,
        voice,
        speed,
        volume,
        response_format: "wav",
        stream: false,
      });

      const arrayBuffer = await response.arrayBuffer();
      const buf = Buffer.from(new Uint8Array(arrayBuffer));
      wavBuffers.push(buf);
    }

    // For simplicity, return first chunk if only one; otherwise concatenate.
    // WAV concatenation: skip 44-byte header on subsequent chunks.
    let finalBuffer: Buffer;
    if (wavBuffers.length === 1) {
      finalBuffer = wavBuffers[0];
    } else {
      // Simple WAV concatenation — skip WAV header (44 bytes) of subsequent chunks
      const WAV_HEADER_SIZE = 44;
      const parts = [wavBuffers[0]];
      for (let i = 1; i < wavBuffers.length; i++) {
        if (wavBuffers[i].length > WAV_HEADER_SIZE) {
          parts.push(wavBuffers[i].subarray(WAV_HEADER_SIZE));
        }
      }
      finalBuffer = Buffer.concat(parts);

      // Fix the data size in the WAV header (bytes 4–7 = file size - 8, bytes 40–43 = data size)
      const dataSize = finalBuffer.length - WAV_HEADER_SIZE;
      finalBuffer.writeUInt32LE(finalBuffer.length - 8, 4);
      finalBuffer.writeUInt32LE(dataSize, 40);
    }

    return new NextResponse(finalBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": finalBuffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("JARVIS TTS error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Синтез речи недоступен." },
      { status: 500 }
    );
  }
}