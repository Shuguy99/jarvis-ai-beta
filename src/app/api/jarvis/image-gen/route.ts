/**
 * J.A.R.V.I.S. — Image Generation API
 *
 * POST /api/jarvis/image-gen
 * Accepts { prompt: string, size?: string } and returns a base64 data URL
 * of the generated image.
 *
 * Supported sizes: 1024x1024, 768x1344, 1344x768, 1440x720
 */

import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";

export const runtime = "nodejs";

const SUPPORTED_SIZES = [
  "1024x1024",
  "768x1344",
  "1344x768",
  "1440x720",
  "1792x1024",
  "1024x1792",
] as const;

type SupportedSize = (typeof SUPPORTED_SIZES)[number];

interface ImageGenRequestBody {
  prompt: string;
  size?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ImageGenRequestBody;
    const { prompt, size: requestedSize } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    if (!ai.isImageGenAvailable()) {
      return NextResponse.json(
        { error: "Image generation requires OPENAI_API_KEY in .env" },
        { status: 503 }
      );
    }

    const size: SupportedSize =
      requestedSize && (SUPPORTED_SIZES as readonly string[]).includes(requestedSize)
        ? (requestedSize as SupportedSize)
        : "1024x1024";

    const result = await ai.imageGen(prompt, size);

    return NextResponse.json({
      image: `data:image/png;base64,${result.base64}`,
      size,
      revisedPrompt: result.revisedPrompt,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("JARVIS image-gen error:", error);

    const message =
      error instanceof Error ? error.message : "Internal J.A.R.V.I.S. error.";

    if (message.includes("size") || message.includes("dimension")) {
      return NextResponse.json(
        { error: `Unsupported size. Use one of: ${SUPPORTED_SIZES.join(", ")}` },
        { status: 400 }
      );
    }

    if (
      message.includes("content") ||
      message.includes("policy") ||
      message.includes("safety")
    ) {
      return NextResponse.json(
        { error: "Prompt blocked by content policy. Please rephrase." },
        { status: 422 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}