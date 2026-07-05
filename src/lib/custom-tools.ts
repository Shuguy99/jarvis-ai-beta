/**
 * JARVIS Custom Tools System
 * Users can define custom tools that the AI agent can invoke
 */

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean";
  description: string;
  required: boolean;
  default?: string | number | boolean;
  enum?: string[]; // allowed values
}

export interface CustomTool {
  id: string;
  name: string;            // function name, e.g. "search_database"
  description: string;     // what the tool does
  enabled: boolean;
  parameters: ToolParameter[];
  handlerType: "api" | "command" | "webhook";
  handlerConfig: {
    url?: string;           // for API/webhook
    method?: string;        // GET, POST
    headers?: Record<string, string>;
    bodyTemplate?: string;  // template with {{param}} placeholders
    command?: string;       // for command type
  };
  createdAt: string;
  lastUsedAt?: string;
  usageCount: number;
}

const STORAGE_KEY = "jarvis-custom-tools";
const uid = () => Math.random().toString(36).slice(2, 10);

export function getTools(): CustomTool[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveTools(tools: CustomTool[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tools)); } catch { /* ignore */ }
}

export function createTool(partial: Partial<CustomTool>): CustomTool {
  const tool: CustomTool = {
    id: uid(),
    name: partial.name || "new_tool",
    description: partial.description || "",
    enabled: true,
    parameters: partial.parameters || [],
    handlerType: partial.handlerType || "api",
    handlerConfig: partial.handlerConfig || {},
    createdAt: new Date().toISOString(),
    usageCount: 0,
  };
  const tools = getTools();
  tools.push(tool);
  saveTools(tools);
  return tool;
}

export function updateTool(id: string, patch: Partial<CustomTool>): CustomTool | null {
  const tools = getTools();
  const idx = tools.findIndex(t => t.id === id);
  if (idx === -1) return null;
  tools[idx] = { ...tools[idx], ...patch };
  saveTools(tools);
  return tools[idx];
}

export function deleteTool(id: string) {
  const tools = getTools().filter(t => t.id !== id);
  saveTools(tools);
}

export function toggleTool(id: string) {
  const tools = getTools();
  const tool = tools.find(t => t.id === id);
  if (tool) {
    tool.enabled = !tool.enabled;
    saveTools(tools);
  }
}

export function getEnabledTools(): CustomTool[] {
  return getTools().filter(t => t.enabled);
}

export function toolToOpenAIFunction(tool: CustomTool) {
  return {
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          tool.parameters.map(p => [p.name, {
            type: p.type,
            description: p.description,
            ...(p.enum ? { enum: p.enum } : {}),
          }])
        ),
        required: tool.parameters.filter(p => p.required).map(p => p.name),
      },
    },
  };
}

// Pre-built template tools
export const TOOL_TEMPLATES: Omit<CustomTool, "id" | "createdAt" | "usageCount">[] = [
  {
    name: "web_search",
    description: "Ищет информацию в интернете по запросу",
    enabled: true,
    parameters: [
      { name: "query", type: "string", description: "Поисковый запрос", required: true },
      { name: "num_results", type: "number", description: "Количество результатов", required: false, default: 5 },
    ],
    handlerType: "api",
    handlerConfig: { url: "/api/jarvis/search", method: "POST", bodyTemplate: '{"query":"{{query}}","limit":{{num_results}}}' },
  },
  {
    name: "get_weather",
    description: "Получает текущую погоду для указанного города",
    enabled: true,
    parameters: [
      { name: "city", type: "string", description: "Название города", required: true },
    ],
    handlerType: "api",
    handlerConfig: { url: "/api/jarvis/weather", method: "GET" },
  },
  {
    name: "create_note",
    description: "Создаёт заметку в JARVIS",
    enabled: true,
    parameters: [
      { name: "title", type: "string", description: "Заголовок заметки", required: true },
      { name: "content", type: "string", description: "Содержимое заметки", required: true },
    ],
    handlerType: "api",
    handlerConfig: { url: "/api/jarvis/notes", method: "POST", bodyTemplate: '{"title":"{{title}}","content":"{{content}}"}' },
  },
  {
    name: "run_calculator",
    description: "Вычисляет математическое выражение",
    enabled: true,
    parameters: [
      { name: "expression", type: "string", description: "Математическое выражение (например: 2+2*3)", required: true },
    ],
    handlerType: "command",
    handlerConfig: { command: "calc {{expression}}" },
  },
];