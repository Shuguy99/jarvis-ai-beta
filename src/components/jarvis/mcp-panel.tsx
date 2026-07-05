import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plug, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Zap, ExternalLink } from "lucide-react";
import {
  getMCPServers, addMCPServer, updateMCPServer, removeMCPServer, toggleMCPServer,
  MCP_TEMPLATES, type MCPServer,
} from "@/lib/mcp-integration";
import { playSound } from "@/lib/sounds";

const STATUS_COLORS: Record<MCPServer["status"], string> = {
  disconnected: "text-muted-foreground",
  connecting: "text-yellow-400",
  connected: "text-green-400",
  error: "text-destructive",
};

const STATUS_LABELS: Record<MCPServer["status"], string> = {
  disconnected: "Offline",
  connecting: "Connecting...",
  connected: "Online",
  error: "Error",
};

export function MCPPanel() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => { refresh(); }, []);

  function refresh() { setServers(getMCPServers()); }

  function handleAddFromTemplate(template: typeof MCP_TEMPLATES[number]) {
    playSound("success");
    addMCPServer(template);
    setShowTemplates(false);
    refresh();
  }

  function handleDelete(id: string) {
    playSound("deactivate");
    removeMCPServer(id);
    refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-primary anim-pulse-glow" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary">MCP Servers</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {servers.filter(s => s.status === "connected").length}/{servers.length}
        </span>
      </div>

      <p className="font-mono text-[10px] text-muted-foreground">
        Model Context Protocol — подключайте внешние инструменты и источники данных.
      </p>

      <div className="space-y-1.5 max-h-60 overflow-y-auto jarvis-scroll">
        {servers.length === 0 && (
          <div className="py-4 text-center">
            <Plug className="mx-auto mb-2 h-6 w-6 text-primary/30" />
            <p className="font-mono text-[10px] text-muted-foreground">Нет MCP серверов</p>
          </div>
        )}
        {servers.map(server => (
          <div key={server.id} className="rounded-lg border border-primary/10 bg-card/30">
            <div
              className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
              onClick={() => setExpandedId(expandedId === server.id ? null : server.id)}
            >
              <button onClick={(e) => { e.stopPropagation(); toggleMCPServer(server.id); refresh(); }} className="text-primary/70">
                {server.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              </button>
              <span className={`flex-1 font-mono text-[10px] truncate ${server.enabled ? "text-foreground" : "text-muted-foreground/50"}`}>
                {server.name}
              </span>
              <span className={`font-mono text-[8px] ${STATUS_COLORS[server.status]}`}>
                {STATUS_LABELS[server.status]}
              </span>
              {server.tools && server.tools.length > 0 && (
                <span className="rounded bg-primary/10 px-1 font-mono text-[8px] text-primary">{server.tools.length}</span>
              )}
              {expandedId === server.id ? <ChevronUp className="h-3 w-3 text-muted-foreground/50" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
            </div>
            <AnimatePresence>
              {expandedId === server.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-primary/10 px-2 py-1.5 space-y-1.5">
                    <div className="font-mono text-[9px] text-muted-foreground">
                      Тип: {server.type} {server.command ? `· ${server.command}` : server.url ? `· ${server.url}` : ""}
                    </div>
                    {server.tools && server.tools.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {server.tools.map(t => (
                          <span key={t.name} className="rounded border border-primary/15 bg-primary/5 px-1 py-0.5 font-mono text-[8px] text-muted-foreground">
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(server.id); }}
                      className="flex items-center gap-1 rounded border border-destructive/20 px-2 py-0.5 font-mono text-[9px] text-destructive/70 hover:bg-destructive/10 transition"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                      Удалить
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 py-1.5 font-mono text-[10px] text-primary transition hover:bg-primary/10"
        >
          <Zap className="h-3 w-3" />
          <span>Шаблоны MCP</span>
        </button>
      </div>

      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-1"
          >
            {MCP_TEMPLATES.map((tmpl, i) => (
              <button
                key={i}
                onClick={() => handleAddFromTemplate(tmpl)}
                className="flex w-full items-center gap-2 rounded-lg border border-primary/10 px-2 py-1.5 text-left transition hover:border-primary/30 hover:bg-primary/5"
              >
                <Plug className="h-3 w-3 text-primary/60" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-foreground">{tmpl.name}</div>
                  <div className="font-mono text-[8px] text-muted-foreground">{tmpl.type} {tmpl.command}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}