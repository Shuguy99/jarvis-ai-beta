/**
 * JARVIS MCP (Model Context Protocol) Integration
 * Framework for connecting external tools and data sources
 * via the Model Context Protocol standard
 */

export interface MCPServer {
  id: string;
  name: string;
  type: "stdio" | "sse" | "websocket";
  command?: string;      // for stdio type
  url?: string;          // for sse/websocket type
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status: "disconnected" | "connecting" | "connected" | "error";
  tools?: MCPTool[];
  lastConnected?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

const STORAGE_KEY = "jarvis-mcp-servers";

const uid = () => Math.random().toString(36).slice(2, 10);

export function getMCPServers(): MCPServer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMCPServers(servers: MCPServer[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(servers)); } catch { /* ignore */ }
}

export function addMCPServer(server: Omit<MCPServer, "id" | "status" | "lastConnected">): MCPServer {
  const newServer: MCPServer = {
    ...server,
    id: uid(),
    status: "disconnected",
    lastConnected: undefined,
  };
  const servers = getMCPServers();
  servers.push(newServer);
  saveMCPServers(servers);
  return newServer;
}

export function updateMCPServer(id: string, patch: Partial<MCPServer>): MCPServer | null {
  const servers = getMCPServers();
  const idx = servers.findIndex(s => s.id === id);
  if (idx === -1) return null;
  servers[idx] = { ...servers[idx], ...patch };
  saveMCPServers(servers);
  return servers[idx];
}

export function removeMCPServer(id: string) {
  saveMCPServers(getMCPServers().filter(s => s.id !== id));
}

export function toggleMCPServer(id: string) {
  const servers = getMCPServers();
  const server = servers.find(s => s.id === id);
  if (server) {
    server.enabled = !server.enabled;
    if (!server.enabled) server.status = "disconnected";
    saveMCPServers(servers);
  }
}

export function getAllMCPTools(): MCPTool[] {
  return getMCPServers()
    .filter(s => s.enabled && s.status === "connected" && s.tools)
    .flatMap(s => s.tools!);
}

// Pre-configured MCP server templates
export const MCP_TEMPLATES: Omit<MCPServer, "id" | "status" | "lastConnected">[] = [
  {
    name: "Filesystem",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/documents"],
    enabled: false,
  },
  {
    name: "GitHub",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_TOKEN: "" },
    enabled: false,
  },
  {
    name: "Brave Search",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    env: { BRAVE_API_KEY: "" },
    enabled: false,
  },
  {
    name: "Memory",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    enabled: false,
  },
  {
    name: "Slack",
    type: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    env: { SLACK_BOT_TOKEN: "", SLACK_TEAM_ID: "" },
    enabled: false,
  },
];