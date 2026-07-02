import { NextRequest, NextResponse } from "next/server";
import { ai } from "@/lib/ai-provider";

export const runtime = "nodejs";

// Simple in-memory cache (5 min TTL)
let cachedInsights: {
  data: { health: number; summary: string; insights: Array<{ type: string; text: string }>; timestamp: string };
  expiresAt: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface Insight {
  type: "info" | "warning" | "critical";
  text: string;
}

interface InsightsResponse {
  health: number;
  summary: string;
  insights: Insight[];
  timestamp: string;
}

async function fetchSystemMetrics(): Promise<Record<string, any>> {
  try {
    const res = await fetch("http://localhost:3000/api/jarvis/system", {
      signal: AbortSignal.timeout(5000),
    });
    return await res.json();
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check cache
    if (cachedInsights && Date.now() < cachedInsights.expiresAt) {
      return NextResponse.json(cachedInsights.data);
    }

    // Get metrics (from body or fetch fresh)
    let metrics: Record<string, any> = {};
    try {
      const body = await req.json();
      metrics = body.metrics || {};
    } catch {
      // No body, fetch fresh
    }

    if (Object.keys(metrics).length === 0) {
      metrics = await fetchSystemMetrics();
    }

    const cpu = metrics.cpuUsage ?? 0;
    const ram = metrics.memUsagePercent ?? 0;
    const disk = metrics.diskUsagePercent ?? 0;
    const uptime = metrics.uptime ?? "unknown";
    const hostname = metrics.hostname ?? "unknown";
    const cores = metrics.cpuCores ?? "unknown";

    const systemPrompt = `Ты — системный аналитик JARVIS. Проанализируй текущие метрики системы и дай краткую оценку.
Метрики: CPU ${cpu.toFixed(1)}%, RAM ${ram.toFixed(1)}%, Disk ${disk.toFixed(1)}%, Uptime ${uptime}, Host ${hostname}, Cores ${cores}.

Ответь ТОЛЬКО валидным JSON (без markdown, без backticks):
{
  "health": <число 1-10>,
  "summary": "<краткий статус 1-2 предложения на русском>",
  "insights": [
    {"type": "info|warning|critical", "text": "<рекомендация на русском>"}
  ]
}

Правила:
- health 1-3: критическое состояние (красный)
- health 4-6: есть проблемы (жёлтый)
- health 7-10: всё хорошо (зелёный)
- Дай 3-5 конкретных рекомендаций
- Если всё хорошо, дай позитивный статус`;

    const reply = await ai.chat([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Проанализируй систему." },
    ], { temperature: 0.3, maxTokens: 512 });

    // Parse JSON from response
    let parsed: InsightsResponse;
    try {
      let jsonStr = reply.trim();
      // Strip markdown fences
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: generate basic insights
      const health = cpu > 90 || ram > 90 ? 3 : cpu > 70 || ram > 70 ? 6 : 9;
      parsed = {
        health,
        summary: `CPU: ${cpu.toFixed(1)}%, RAM: ${ram.toFixed(1)}%, Disk: ${disk.toFixed(1)}%`,
        insights: [
          ...(cpu > 80 ? [{ type: "warning", text: `CPU загрузка ${cpu.toFixed(1)}% — высокая нагрузка` }] : []),
          ...(ram > 80 ? [{ type: "warning", text: `RAM использование ${ram.toFixed(1)}% — рекомендуется закрыть неиспользуемые приложения` }] : []),
          ...(disk > 90 ? [{ type: "critical", text: `Диск заполнен на ${disk.toFixed(1)}% — срочно освободите место` }] : []),
          ...(cpu < 30 && ram < 50 ? [{ type: "info", text: "Система работает стабильно, ресурсы в норме" }] : []),
        ],
        timestamp: new Date().toISOString(),
      };
    }

    // Validate and clamp health score
    parsed.health = Math.max(1, Math.min(10, Math.round(parsed.health || 5)));
    if (!parsed.insights || !Array.isArray(parsed.insights)) {
      parsed.insights = [];
    }
    parsed.timestamp = new Date().toISOString();

    // Cache result
    cachedInsights = {
      data: parsed,
      expiresAt: Date.now() + CACHE_TTL,
    };

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("[Insights API Error]", error?.message);
    return NextResponse.json(
      { error: "Ошибка анализа системы", health: 5, summary: "Недоступен", insights: [], timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

// GET: return cached insights or fetch fresh
export async function GET() {
  if (cachedInsights && Date.now() < cachedInsights.expiresAt) {
    return NextResponse.json(cachedInsights.data);
  }
  // Trigger a POST-like analysis
  try {
    const metrics = await fetchSystemMetrics();
    const res = new NextRequest("http://internal/insights", {
      method: "POST",
      body: JSON.stringify({ metrics }),
    });
    // Inline the logic for GET
    const cpu = metrics.cpuUsage ?? 0;
    const ram = metrics.memUsagePercent ?? 0;
    const health = cpu > 90 || ram > 90 ? 3 : cpu > 70 || ram > 70 ? 6 : 9;
    return NextResponse.json({
      health,
      summary: `CPU: ${cpu.toFixed(1)}%, RAM: ${ram.toFixed(1)}%`,
      insights: cpu < 50 && ram < 60
        ? [{ type: "info", text: "Система в норме" }]
        : [{ type: "warning", text: "Повышенная нагрузка" }],
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      { health: 5, summary: "Загрузка...", insights: [], timestamp: new Date().toISOString() },
      { status: 200 }
    );
  }
}