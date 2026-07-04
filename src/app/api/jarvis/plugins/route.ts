import { json } from "@/lib/json-response";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type PluginAction = (params: Record<string, unknown>) => Promise<Record<string, unknown>>;

const serverActions = new Map<string, PluginAction>();

export function registerServerAction(pluginId: string, actionName: string, handler: PluginAction): void {
  serverActions.set(`${pluginId}:${actionName}`, handler);
}

export function unregisterServerActions(pluginId: string): void {
  for (const key of serverActions.keys()) {
    if (key.startsWith(`${pluginId}:`)) serverActions.delete(key);
  }
}

function registerBuiltinPlugins() {
  registerServerAction("system-doctor", "healthCheck", async () => {
    const memUsage = process.memoryUsage();
    return {
      status: "ok",
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      uptime: `${Math.round(process.uptime())}s`,
      timestamp: new Date().toISOString(),
    };
  });

  registerServerAction("network-scanner", "getConnections", async () => {
    return {
      status: "ok",
      protocol: "HTTP/1.1",
      timestamp: new Date().toISOString(),
      note: "Full network scanning requires system-level access (Electron)",
    };
  });
}

registerBuiltinPlugins();

export async function GET() {
  const dbPlugins = await prisma.plugin.findMany({ orderBy: { createdAt: "asc" } });

  const plugins = dbPlugins.map((p) => ({
    id: p.pluginId,
    name: p.name,
    description: p.description,
    version: p.version,
    author: p.author,
    category: p.category,
    icon: p.icon,
    enabled: p.enabled,
    settings: JSON.parse(p.settings),
    source: "database" as const,
  }));

  return json({
    plugins,
    serverPluginsAvailable: true,
    actionCount: serverActions.size,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, pluginId, params, name, description, version, author, category, icon, settings } = body as {
      action?: string;
      pluginId?: string;
      params?: Record<string, unknown>;
      name?: string;
      description?: string;
      version?: string;
      author?: string;
      category?: string;
      icon?: string;
      settings?: unknown;
    };

    if (action === "register") {
      if (!pluginId || !name) {
        return json({ error: "pluginId and name required for registration" }, 400);
      }

      const plugin = await prisma.plugin.upsert({
        where: { pluginId },
        create: {
          pluginId,
          name: name ?? pluginId,
          description: description ?? "",
          version: version ?? "1.0.0",
          author: author ?? "unknown",
          category: category ?? "system",
          icon: icon ?? "Puzzle",
          settings: JSON.stringify(settings ?? []),
        },
        update: {
          name: name ?? undefined,
          description: description ?? undefined,
          version: version ?? undefined,
          author: author ?? undefined,
          category: category ?? undefined,
          icon: icon ?? undefined,
        },
      });

      return json({ success: true, plugin });
    }

    if (action === "unregister") {
      if (!pluginId) {
        return json({ error: "pluginId required" }, 400);
      }
      await prisma.plugin.deleteMany({ where: { pluginId } });
      unregisterServerActions(pluginId);
      return json({ success: true, pluginId });
    }

    if (action === "toggle") {
      if (!pluginId) {
        return json({ error: "pluginId required" }, 400);
      }
      const current = await prisma.plugin.findUnique({ where: { pluginId } });
      if (!current) {
        return json({ error: "Plugin not found" }, 404);
      }
      const updated = await prisma.plugin.update({
        where: { pluginId },
        data: { enabled: !current.enabled },
      });
      return json({ success: true, enabled: updated.enabled });
    }

    if (action === "execute") {
      if (!pluginId || !params?.actionName) {
        return json({ error: "pluginId and params.actionName required" }, 400);
      }
      const handler = serverActions.get(`${pluginId}:${params.actionName as string}`);
      if (!handler) {
        return json({ error: `Action ${params.actionName} not found for plugin ${pluginId}` }, 404);
      }
      const result = await handler(params as Record<string, unknown>);
      return json({ success: true, result });
    }

    return json({ error: "Unknown action. Use: register, unregister, toggle, execute." }, 400);
  } catch (error) {
    console.error("Plugin API error:", error);
    return json({ error: error instanceof Error ? error.message : "Plugin API error" }, 500);
  }
}