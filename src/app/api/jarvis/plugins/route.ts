import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/jarvis/plugins
 * Returns list of registered plugins with their status.
 * Plugins can register by POSTing to this endpoint.
 */
export async function GET() {
  // Placeholder — in a full implementation, this would query a DB table.
  // For now, the plugin registry is client-side only (plugin-registry.ts).
  // This endpoint exists as the foundation for server-side plugins.
  return NextResponse.json({
    plugins: [],
    serverPluginsAvailable: false,
    message: "Server-side plugin system foundation. Client plugins managed via plugin-registry.",
  });
}

/**
 * POST /api/jarvis/plugins/execute
 * Execute a server-side plugin action.
 * Body: { pluginId: string, action: string, params?: Record<string, unknown> }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pluginId, action, params } = body as {
      pluginId?: string;
      action?: string;
      params?: Record<string, unknown>;
    };

    if (!pluginId || !action) {
      return NextResponse.json(
        { error: "Missing pluginId or action" },
        { status: 400 }
      );
    }

    // Placeholder for future server-side plugin execution
    return NextResponse.json({
      pluginId,
      action,
      status: "placeholder",
      message: "Server-side plugin execution not yet implemented. Use client-side plugins.",
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}