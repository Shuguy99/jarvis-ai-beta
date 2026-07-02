import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const VALID_KEYS = [
  // Voice
  "ttsRate",
  "ttsPitch",
  "volume",
  "autoSpeak",
  "language",
  // Behavior / Personality
  "persona",
  "userName",
  "formality",
  "humor",
  "responseStyle",
  "temperature",
  "maxTokens",
  "contextWindow",
  "customPrompt",
];

const DEFAULTS: Record<string, string> = {
  ttsRate: "1.05",
  ttsPitch: "0.95",
  volume: "1.0",
  autoSpeak: "true",
  language: "ru",
  // Behavior defaults
  persona: "classic",
  userName: "",
  formality: "0.7",
  humor: "0.4",
  responseStyle: "standard",
  temperature: "0.7",
  maxTokens: "2048",
  contextWindow: "20",
  customPrompt: "",
};

/**
 * GET /api/jarvis/settings
 * Returns all settings (with defaults for missing keys)
 */
export async function GET() {
  try {
    const rows = await db.setting.findMany({
      select: { key: true, value: true },
    });

    const stored = new Map(rows.map((r) => [r.key, r.value]));

    const settings: Record<string, string> = {};
    for (const key of VALID_KEYS) {
      settings[key] = stored.get(key) ?? DEFAULTS[key] ?? "";
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("JARVIS settings GET error:", error);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/jarvis/settings
 * Upserts key-value pairs. Body: { settings: { key: value, ... } }
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const incoming = body.settings as Record<string, string> | undefined;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { error: "Body must contain { settings: { key: value, ... } }" },
        { status: 400 }
      );
    }

    // Validate keys
    for (const key of Object.keys(incoming)) {
      if (!VALID_KEYS.includes(key)) {
        return NextResponse.json(
          { error: `Invalid setting key: ${key}` },
          { status: 400 }
        );
      }
    }

    // Upsert each setting
    for (const [key, value] of Object.entries(incoming)) {
      await db.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("JARVIS settings PUT error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}