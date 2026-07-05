import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wrench, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Zap, Globe, Terminal, Webhook } from "lucide-react";
import {
  getTools, createTool, updateTool, deleteTool, toggleTool,
  TOOL_TEMPLATES, type CustomTool,
} from "@/lib/custom-tools";
import { playSound } from "@/lib/sounds";

const HANDLER_ICONS: Record<string, React.ReactNode> = {
  api: <Globe className="h-3 w-3" />,
  command: <Terminal className="h-3 w-3" />,
  webhook: <Webhook className="h-3 w-3" />,
};

export function CustomToolsPanel() {
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingTool, setEditingTool] = useState<CustomTool | null>(null);

  useEffect(() => { refresh(); }, []);

  function refresh() { setTools(getTools()); }

  function handleCreate() {
    playSound("success");
    const tool = createTool({ name: "new_tool", description: "" });
    setEditingTool(tool);
    setExpandedId(tool.id);
    refresh();
  }

  function handleCreateFromTemplate(template: typeof TOOL_TEMPLATES[number]) {
    playSound("success");
    const tool = createTool(template);
    setEditingTool(tool);
    setExpandedId(tool.id);
    setShowTemplates(false);
    refresh();
  }

  function handleDelete(id: string) {
    playSound("deactivate");
    deleteTool(id);
    if (expandedId === id) setExpandedId(null);
    refresh();
  }

  function handleToggle(id: string) {
    playSound("click");
    toggleTool(id);
    refresh();
  }

  function handleSave(tool: CustomTool) {
    playSound("success");
    updateTool(tool.id, tool);
    setEditingTool(null);
    refresh();
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary anim-pulse-glow" />
          <span className="font-mono text-[11px] uppercase tracking-wider text-primary">Custom Tools</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {tools.filter(t => t.enabled).length}/{tools.length} активно
        </span>
      </div>

      {/* Tools List */}
      <div className="space-y-1.5 max-h-80 overflow-y-auto jarvis-scroll">
        {tools.length === 0 && (
          <div className="py-4 text-center">
            <Wrench className="mx-auto mb-2 h-6 w-6 text-primary/30" />
            <p className="font-mono text-[10px] text-muted-foreground">Нет кастомных тулов</p>
          </div>
        )}
        {tools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            isExpanded={expandedId === tool.id}
            isEditing={editingTool?.id === tool.id}
            onToggleExpand={() => setExpandedId(expandedId === tool.id ? null : tool.id)}
            onToggle={() => handleToggle(tool.id)}
            onDelete={() => handleDelete(tool.id)}
            onSave={handleSave}
            onCancel={() => setEditingTool(null)}
            onEdit={() => setEditingTool(tool)}
          />
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCreate}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/30 py-1.5 font-mono text-[10px] text-primary transition hover:bg-primary/10 hover:border-primary/50"
        >
          <Plus className="h-3 w-3" />
          <span>Создать</span>
        </button>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 py-1.5 font-mono text-[10px] text-primary transition hover:bg-primary/10"
        >
          <Zap className="h-3 w-3" />
          <span>Шаблоны</span>
        </button>
      </div>

      {/* Templates */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden space-y-1"
          >
            {TOOL_TEMPLATES.map((tmpl, i) => (
              <button
                key={i}
                onClick={() => handleCreateFromTemplate(tmpl)}
                className="flex w-full items-center gap-2 rounded-lg border border-primary/10 px-2 py-1.5 text-left transition hover:border-primary/30 hover:bg-primary/5"
              >
                {HANDLER_ICONS[tmpl.handlerType]}
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-foreground truncate">{tmpl.name}</div>
                  <div className="font-mono text-[9px] text-muted-foreground truncate">{tmpl.description}</div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tool Card ────────────────────────────────────────

function ToolCard({ tool, isExpanded, isEditing, onToggleExpand, onToggle, onDelete, onSave, onCancel, onEdit }: {
  tool: CustomTool;
  isExpanded: boolean;
  isEditing: boolean;
  onToggleExpand: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onSave: (tool: CustomTool) => void;
  onCancel: () => void;
  onEdit: () => void;
}) {
  const [editName, setEditName] = useState(tool.name);
  const [editDesc, setEditDesc] = useState(tool.description);
  const [editUrl, setEditUrl] = useState(tool.handlerConfig.url || "");
  const [editMethod, setEditMethod] = useState(tool.handlerConfig.method || "GET");

  useEffect(() => {
    setEditName(tool.name);
    setEditDesc(tool.description);
    setEditUrl(tool.handlerConfig.url || "");
    setEditMethod(tool.handlerConfig.method || "GET");
  }, [tool.name, tool.description, tool.handlerConfig.url, tool.handlerConfig.method]);

  if (isEditing) {
    return (
      <div className="space-y-2 rounded-lg border border-primary/30 bg-card/50 p-2.5">
        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="tool_name" className="w-full rounded border border-primary/20 bg-background/60 px-2 py-1 font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Описание..." rows={2} className="w-full rounded border border-primary/20 bg-background/60 px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
        <div className="flex gap-1.5">
          <select value={editMethod} onChange={e => setEditMethod(e.target.value)} className="rounded border border-primary/20 bg-background/60 px-1 py-0.5 font-mono text-[10px] text-foreground">
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
          </select>
          <input value={editUrl} onChange={e => setEditUrl(e.target.value)} placeholder="/api/..." className="flex-1 rounded border border-primary/20 bg-background/60 px-2 py-0.5 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => onSave({ ...tool, name: editName, description: editDesc, handlerConfig: { ...tool.handlerConfig, url: editUrl, method: editMethod } })} className="flex-1 rounded border border-primary/30 bg-primary/10 py-1 font-mono text-[9px] text-primary hover:bg-primary/20">Сохранить</button>
          <button onClick={onCancel} className="flex-1 rounded border border-primary/20 py-1 font-mono text-[9px] text-muted-foreground hover:bg-primary/5">Отмена</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border transition ${tool.enabled ? "border-primary/20 bg-card/30" : "border-primary/10 bg-card/10 opacity-50"}`}>
      <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer" onClick={onToggleExpand}>
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-primary/70 flex-shrink-0">
          {tool.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
        </button>
        {HANDLER_ICONS[tool.handlerType]}
        <span className="flex-1 font-mono text-[10px] text-foreground truncate">{tool.name}</span>
        <span className="font-mono text-[8px] text-muted-foreground">{tool.parameters.length}p</span>
        {isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground/50" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/50" />}
      </div>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="border-t border-primary/10 px-2 py-1.5 space-y-1.5">
              <p className="font-mono text-[9px] text-muted-foreground">{tool.description || "Без описания"}</p>
              {tool.handlerConfig.url && (
                <p className="font-mono text-[8px] text-primary/60">{tool.handlerConfig.method || "GET"} {tool.handlerConfig.url}</p>
              )}
              {tool.handlerConfig.command && (
                <p className="font-mono text-[8px] text-primary/60">$ {tool.handlerConfig.command}</p>
              )}
              {tool.parameters.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tool.parameters.map(p => (
                    <span key={p.name} className="rounded border border-primary/15 bg-primary/5 px-1 py-0.5 font-mono text-[8px] text-muted-foreground">
                      {p.name}: {p.type} {p.required && "*"}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1 pt-1">
                <button onClick={onEdit} className="flex-1 rounded border border-primary/20 py-0.5 font-mono text-[9px] text-muted-foreground hover:bg-primary/5">Редактировать</button>
                <button onClick={onDelete} className="rounded border border-destructive/20 py-0.5 px-2 font-mono text-[9px] text-destructive/70 hover:bg-destructive/10"><Trash2 className="h-2.5 w-2.5" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}