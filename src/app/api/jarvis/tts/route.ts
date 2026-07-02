import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * POST /api/jarvis/tts
 * Body: { text, voice?, speed?, volume? }
 *
 * NOTE: For local PC use, TTS is handled entirely in the browser via
 * the Web Speech API (SpeechSynthesis). This endpoint is kept for
 * cloud/ZAI mode where server-side TTS is available.
 *
 * Returns: audio/wav binary or a JSON response indicating browser TTS should be used.
 */
export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Текст пуст." }, { status: 400 });
    }

    // Check if ZAI cloud mode is active
    const provider = process.env.AI_PROVIDER?.toLowerCase();
    if (provider !== "zai") {
      // Local mode — tell the client to use browser SpeechSynthesis
      return NextResponse.json({
        useBrowserTTS: true,
        text: text.trim(),
        message: "Browser TTS is used in local mode.",
      });
    }

    // ZAI cloud mode — use server-side TTS
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    const zai = await ZAI.create();

    const {
      voice = "kazi",
      speed = 0.92,
      volume = 1.0,
    } = await req.json();

    const clean = text.replace(/\s+/g, " ").trim();
    const MAX_CHUNK_LENGTH = 1000;
    const chunks = clean.length <= MAX_CHUNK_LENGTH
      ? [clean]
      : splitText(clean, MAX_CHUNK_LENGTH);

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

    let finalBuffer: Buffer;
    if (wavBuffers.length === 1) {
      finalBuffer = wavBuffers[0];
    } else {
      const WAV_HEADER_SIZE = 44;
      const parts = [wavBuffers[0]];
      for (let i = 1; i < wavBuffers.length; i++) {
        if (wavBuffers[i].length > WAV_HEADER_SIZE) {
          parts.push(wavBuffers[i].subarray(WAV_HEADER_SIZE));
        }
      }
      finalBuffer = Buffer.concat(parts);
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

function splitText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = -1;
    for (let i = Math.min(remaining.length, maxLen) - 1; i >= 0; i--) {
      const ch = remaining[i];
      if (ch === "." || ch === "!" || ch === "?" || ch === "\n") {
        splitIdx = i + 1;
        break;
      }
    }
    if (splitIdx === -1) {
      for (let i = Math.min(remaining.length, maxLen) - 1; i >= 0; i--) {
        if (remaining[i] === " ") { splitIdx = i + 1; break; }
      }
    }
    if (splitIdx === -1) splitIdx = Math.min(remaining.length, maxLen);
    chunks.push(remaining.slice(0, splitIdx).trim());
    remaining = remaining.slice(splitIdx).trim();
  }
  return chunks.filter((c) => c.length > 0);
}