export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: string;
  // optional UI metadata
  pending?: boolean;
  streaming?: boolean;
  source?: "voice" | "text" | "image";
  hasAudio?: boolean;
  imagePreview?: string;
  generatedImage?: string;
  imageAttachments?: Array<{ id: string; dataUrl: string; name: string }>;
  reactions?: string[];
  moodEmoji?: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface JarvisStatus {
  state: "idle" | "listening" | "thinking" | "speaking" | "error";
  label: string;
}

// ─── Agent Loop Types ──────────────────────────────────────────

export type AgentStatus = "idle" | "thinking" | "calling-tool" | "processing" | "responding";

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface AgentToolCallParsed {
  id: string;
  name: string;
  params: Record<string, unknown>;
}

export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  content: string;
  error?: string;
}

export interface AgentLoopLogEntry {
  iteration: number;
  type: "thinking" | "tool_call" | "tool_result" | "response";
  toolName?: string;
  content: string;
  timestamp: string;
}

export interface AgentLoopConfig {
  maxIterations?: number;
  systemPrompt?: string;
  onStatusChange?: (status: AgentStatus) => void;
  onToolCall?: (call: AgentToolCallParsed) => void;
  onToolResult?: (result: ToolCallResult) => void;
  onToken?: (token: string) => void;
  onLog?: (entry: AgentLoopLogEntry) => void;
  temperature?: number;
  maxTokens?: number;
}

// ─── Memory System Types ──────────────────────────────────────────

export type MemoryCategory = 'preference' | 'fact' | 'context' | 'instruction' | 'project';

export interface MemoryEntry {
  id: string;
  content: string;
  category: MemoryCategory;
  timestamp: string;
  source: 'auto' | 'manual';
  metadata?: Record<string, string>;
}

export interface MemoryStats {
  total: number;
  byCategory: Record<string, number>;
}

// ─── Plugin System Types ───────────────────────────────────────

/** JSON Schema subset matching OpenAI function-calling parameter format */
export type JSONSchema = Record<string, unknown>;

export interface PluginToolDef {
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: string; // function name in plugin code
}

export interface PluginPanelDef {
  id: string;
  title: string;
  icon?: string;
  component: string; // component name exported by plugin
  position: "left" | "right" | "center";
}

export interface PluginSettingDef {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  default: unknown;
  options?: string[]; // for select type
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string;
  tools?: PluginToolDef[];
  panels?: PluginPanelDef[];
  settings?: PluginSettingDef[];
  permissions?: string[];
}

export interface PluginState {
  manifest: PluginManifest;
  enabled: boolean;
  settings: Record<string, unknown>;
}
