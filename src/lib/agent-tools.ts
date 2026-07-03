/**
 * JARVIS Agent Tool Registry
 *
 * Defines built-in tools the agent can invoke during task execution.
 * Each tool has a name, description, icon, category, parameter schema,
 * and an async execute function.
 */

import { readFile, mkdir, writeFile, unlink, access } from "fs/promises";

// ─── Safe Math Parser (recursive descent) ────────────────────
// Replaces the former `new Function()` calculator to eliminate
// arbitrary code execution vectors.

const MATH_FUNCTIONS: Record<string, (..._args: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  sqrt: Math.sqrt, abs: Math.abs,
  log: Math.log, log2: Math.log2, log10: Math.log10,
  exp: Math.exp, pow: Math.pow,
  ceil: Math.ceil, floor: Math.floor, round: Math.round,
  min: Math.min, max: Math.max,
};
const MATH_CONSTANTS: Record<string, number> = { PI: Math.PI, E: Math.E, pi: Math.PI, e: Math.E };

function safeEvalMath(input: string): number {
  // Tokenize
  const tokens = tokenize(input);
  let pos = 0;

  function tokenize(src: string): Array<{ t: "num" | "op" | "ident" | "lparen" | "rparen" | "comma"; v: string }> {
    const result: Array<{ t: "num" | "op" | "ident" | "lparen" | "rparen" | "comma"; v: string }> = [];
    let i = 0;
    while (i < src.length) {
      if (/\s/.test(src[i])) { i++; continue; }
      if ("+-*/%(),".includes(src[i])) {
        if (src[i] === "(") { result.push({ t: "lparen", v: "(" }); }
        else if (src[i] === ")") { result.push({ t: "rparen", v: ")" }); }
        else if (src[i] === ",") { result.push({ t: "comma", v: "," }); }
        else { result.push({ t: "op", v: src[i] }); }
        i++; continue;
      }
      // Numbers: digits and one dot
      if (/[0-9.]/.test(src[i])) {
        let num = "";
        let dots = 0;
        while (i < src.length && (/[0-9]/.test(src[i]) || (src[i] === "." && dots === 0))) {
          if (src[i] === ".") dots++;
          num += src[i]; i++;
        }
        result.push({ t: "num", v: num });
        continue;
      }
      // Identifiers: function names, constants
      if (/[a-zA-Z_]/.test(src[i])) {
        let ident = "";
        while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) {
          ident += src[i]; i++;
        }
        result.push({ t: "ident", v: ident });
        continue;
      }
      throw new Error(`Unexpected character: '${src[i]}'`);
    }
    return result;
  }

  function peek() { return tokens[pos] ?? null; }
  function consume() { return tokens[pos++]; }

  function parseExpr(): number {
    let left = parseTerm();
    while (peek()?.t === "op" && (peek()?.v === "+" || peek()?.v === "-")) {
      const op = consume()!.v;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (peek()?.t === "op" && ("*/%".includes(peek()?.v ?? ""))) {
      const op = consume()!.v;
      const right = parseUnary();
      if (op === "*") left *= right;
      else if (op === "/") {
        if (right === 0) throw new Error("Division by zero");
        left /= right;
      } else left %= right;
    }
    return left;
  }

  function parseUnary(): number {
    if (peek()?.t === "op" && peek()?.v === "-") {
      consume();
      return -parsePower();
    }
    if (peek()?.t === "op" && peek()?.v === "+") {
      consume();
      return parsePower();
    }
    return parsePower();
  }

  function parsePower(): number {
    const base = parsePrimary();
    // Right-associative: 2^3^2 = 2^(3^2) — but we don't support ^ in the grammar,
    // users use pow() instead. Skip for safety.
    return base;
  }

  function parsePrimary(): number {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of expression");

    // Parenthesized sub-expression
    if (tok.t === "lparen") {
      consume(); // (
      const val = parseExpr();
      if (!peek() || peek()!.t !== "rparen") throw new Error("Missing closing ')'");
      consume(); // )
      return val;
    }

    // Number literal
    if (tok.t === "num") {
      consume();
      const n = Number(tok.v);
      if (!Number.isFinite(n)) throw new Error(`Invalid number: ${tok.v}`);
      return n;
    }

    // Identifier: function call or constant
    if (tok.t === "ident") {
      const name = tok.v;
      consume();

      // Constant
      if (name in MATH_CONSTANTS && peek()?.t !== "lparen") {
        return MATH_CONSTANTS[name];
      }

      // Function call
      if (name in MATH_FUNCTIONS && peek()?.t === "lparen") {
        consume(); // (
        const args: number[] = [];
        if (peek()?.t !== "rparen") {
          args.push(parseExpr());
          while (peek()?.t === "comma") {
            consume(); // ,
            args.push(parseExpr());
          }
        }
        if (!peek() || peek()!.t !== "rparen") throw new Error(`Missing ')' after ${name}() arguments`);
        consume(); // )
        const fn = MATH_FUNCTIONS[name];
        return fn(...args);
      }

      // Unknown identifier
      if (name in MATH_CONSTANTS) return MATH_CONSTANTS[name];
      throw new Error(`Unknown identifier: ${name}`);
    }

    throw new Error(`Unexpected token: ${tok.t} '${tok.v}'`);
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error(`Unexpected trailing input after position ${pos}`);
  if (!Number.isFinite(result)) throw new Error("Result is not a finite number");
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────

// Sensitive paths that the agent must never touch
const FORBIDDEN_PATHS = [
  "/home/z/.ssh",
  "/home/z/.bashrc",
  "/home/z/.bash_profile",
  "/home/z/.profile",
  "/home/z/.zshrc",
  "/home/z/.zprofile",
  "/home/z/.env",
  "/home/z/.gitconfig",
  "/home/z/.npmrc",
  "/home/z/.gnupg",
  "/home/z/.aws",
  "/home/z/.docker",
  "/home/z/.config/credentials",
  "/etc/passwd",
  "/etc/shadow",
  "/etc/sudoers",
];

function validateFilePath(filePath: string): string | null {
  if (!filePath.startsWith("/home/z/") || filePath.includes("..")) {
    return "Access denied: path must start with /home/z/ and must not contain '..'";
  }
  const resolved = filePath.replace(/\\/g, "/");
  for (const forbidden of FORBIDDEN_PATHS) {
    if (resolved === forbidden || resolved.startsWith(forbidden + "/")) {
      return `Access denied: protected path (${forbidden})`;
    }
  }
  return null;
}

// ─── Types ─────────────────────────────────────────────────────

export interface AgentTool {
  name: string;
  description: string;
  icon: string; // lucide icon name
  category: "system" | "web" | "files" | "analysis" | "utility";
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  execute: (_params: Record<string, string>) => Promise<ToolResult>;
}

export interface ToolResult {
  success: boolean;
  data: unknown;
  display: string;
  error?: string;
}

// ─── Internal API helper ───────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

async function callInternalApi(
  endpoint: string,
  options?: RequestInit
): Promise<unknown> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      (data as Record<string, unknown>)?.error ?? `HTTP ${res.status}`;
    throw new Error(String(msg));
  }
  return data;
}

// ─── Built-in tools ────────────────────────────────────────────

const tools: AgentTool[] = [
  // 1. system_info
  {
    name: "system_info",
    description:
      "Get current system metrics: CPU load, RAM usage, disk space, network throughput, uptime, hostname, temperature.",
    icon: "Cpu",
    category: "system",
    parameters: [],
    async execute() {
      const data = (await callInternalApi("/api/jarvis/system")) as Record<
        string,
        unknown
      >;
      return {
        success: true,
        data,
        display: [
          `Host: ${data.hostname}`,
          `Platform: ${data.platform}`,
          `CPU Load: ${data.cpuLoad}% (${data.cpus} cores)`,
          `RAM: ${data.memPct}% (${formatBytes(data.memUsed as number)} / ${formatBytes(data.memTotal as number)})`,
          `Disk: ${data.diskPct}% (${formatBytes(data.diskUsed as number)} / ${formatBytes(data.diskTotal as number)})`,
          `Net In: ${data.netSpeedIn} Mbps / Out: ${data.netSpeedOut} Mbps`,
          `Temp: ${data.temp}°C`,
          `Uptime: ${formatUptime(data.uptime as number)}`,
        ].join("\n"),
      };
    },
  },

  // 2. system_processes
  {
    name: "system_processes",
    description:
      "List the top running processes sorted by CPU usage. Returns PID, name, CPU%, MEM%, user, and status.",
    icon: "List",
    category: "system",
    parameters: [
      {
        name: "sort",
        type: "string",
        required: false,
        description: 'Sort by: "cpu", "mem", or "name". Default: "cpu".',
      },
      {
        name: "filter",
        type: "string",
        required: false,
        description: "Text filter to search process names or PIDs.",
      },
    ],
    async execute(params) {
      const sp = new URLSearchParams();
      if (params.sort) sp.set("sort", params.sort);
      if (params.filter) sp.set("filter", params.filter);
      const qs = sp.toString();
      const data = (await callInternalApi(
        `/api/jarvis/processes${qs ? `?${qs}` : ""}`
      )) as { processes: Array<Record<string, unknown>> };

      const lines = data.processes
        .slice(0, 15)
        .map(
          (p) =>
            `  PID ${p.pid}  ${String(p.cpu).padStart(5)}% CPU  ${String(p.mem).padStart(5)}% MEM  ${p.user}  ${p.status}  ${p.name}`
        )
        .join("\n");

      return {
        success: true,
        data,
        display: `Top ${Math.min(data.processes.length, 15)} processes:\n${lines}`,
      };
    },
  },

  // 3. web_search
  {
    name: "web_search",
    description:
      "Search the web for information. Returns a list of search results with titles, URLs, and snippets.",
    icon: "Globe",
    category: "web",
    parameters: [
      {
        name: "query",
        type: "string",
        required: true,
        description: "The search query string.",
      },
    ],
    async execute(params) {
      if (!params.query) {
        return {
          success: false,
          data: null,
          display: "Error: query parameter is required.",
          error: "Missing required parameter: query",
        };
      }
      const data = (await callInternalApi("/api/jarvis/search", {
        method: "POST",
        body: JSON.stringify({ query: params.query }),
      })) as {
        results: Array<Record<string, unknown>>;
        available: boolean;
        message?: string;
      };

      if (!data.available || data.results.length === 0) {
        return {
          success: true,
          data,
          display: data.message ?? "Web search returned no results.",
        };
      }

      const lines = data.results
        .slice(0, 10)
        .map(
          (r, i) =>
            `${i + 1}. ${r.name}\n   ${r.url}\n   ${(r.snippet as string) ?? ""}`
        )
        .join("\n\n");

      return {
        success: true,
        data,
        display: lines,
      };
    },
  },

  // 4. file_list
  {
    name: "file_list",
    description:
      'List files and directories at a given path. Default path: "/home/z/my-project".',
    icon: "FolderOpen",
    category: "files",
    parameters: [
      {
        name: "path",
        type: "string",
        required: false,
        description:
          'Absolute directory path to list. Default: "/home/z/my-project".',
      },
    ],
    async execute(params) {
      const targetPath = params.path ?? "/home/z/my-project";
      const data = (await callInternalApi(
        `/api/jarvis/files?path=${encodeURIComponent(targetPath)}`
      )) as {
        path: string;
        files: Array<Record<string, unknown>>;
      };

      const lines = data.files
        .map((f) => {
          const prefix = f.type === "dir" ? "📁" : "📄";
          const size = f.type === "file" ? `  ${formatBytes(f.size as number)}` : "";
          return `${prefix} ${f.name}${size}`;
        })
        .join("\n");

      return {
        success: true,
        data,
        display: `Directory: ${data.path}\n${lines}`,
      };
    },
  },

  // 5. get_weather
  {
    name: "get_weather",
    description:
      "Get current weather conditions and a 7-day forecast. Uses Open-Meteo API. Default location: Moscow.",
    icon: "CloudSun",
    category: "utility",
    parameters: [
      {
        name: "lat",
        type: "string",
        required: false,
        description: "Latitude. Default: 55.75 (Moscow).",
      },
      {
        name: "lon",
        type: "string",
        required: false,
        description: "Longitude. Default: 37.62 (Moscow).",
      },
    ],
    async execute(params) {
      const sp = new URLSearchParams();
      sp.set("lat", params.lat ?? "55.75");
      sp.set("lon", params.lon ?? "37.62");
      const data = (await callInternalApi(
        `/api/jarvis/weather?${sp.toString()}`
      )) as Record<string, unknown>;

      const current = data.current as Record<string, unknown> | undefined;
      const daily = data.daily as Record<string, unknown[]> | undefined;

      let display = "";
      if (current) {
        display += [
          `Current weather:`,
          `  Temperature: ${current.temperature_2m}°C (feels like ${current.apparent_temperature}°C)`,
          `  Humidity: ${current.relative_humidity_2m}%`,
          `  Wind: ${current.wind_speed_10m} km/h`,
          `  Pressure: ${current.pressure_msl} hPa`,
          `  Precipitation: ${current.precipitation} mm`,
        ].join("\n");
      }
      if (daily) {
        const dates = daily.time as string[];
        const maxT = daily.temperature_2m_max as number[];
        const minT = daily.temperature_2m_min as number[];
        display += "\n\n7-day forecast:";
        for (let i = 0; i < Math.min(dates.length, 7); i++) {
          display += `\n  ${dates[i]}: ${maxT[i]}° / ${minT[i]}°C`;
        }
      }

      return {
        success: true,
        data,
        display: display || "Weather data received but could not be parsed.",
      };
    },
  },

  // 6. calculator
  {
    name: "calculator",
    description:
      "Evaluate a mathematical expression and return the result. Supports +, -, *, /, %, parentheses, and common functions (sin, cos, sqrt, abs, log, pow, PI, E).",
    icon: "Calculator",
    category: "analysis",
    parameters: [
      {
        name: "expression",
        type: "string",
        required: true,
        description: "The mathematical expression to evaluate.",
      },
    ],
    async execute(params) {
      if (!params.expression) {
        return {
          success: false,
          data: null,
          display: "Error: expression parameter is required.",
          error: "Missing required parameter: expression",
        };
      }

      const expr = params.expression.trim();

      try {
        const result = safeEvalMath(expr);
        const displayVal = typeof result === "number"
          ? Number.isInteger(result) ? String(result) : result.toFixed(6).replace(/\.?0+$/, "")
          : String(result);

        return {
          success: true,
          data: { expression: expr, result },
          display: `${expr} = ${displayVal}`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Calculation error";
        return {
          success: false,
          data: null,
          display: `Error evaluating "${expr}": ${msg}`,
          error: msg,
        };
      }
    },
  },

  // 7. get_time
  {
    name: "get_time",
    description:
      "Get the current date and time in multiple timezones: local, UTC, Moscow, New York, London, Tokyo, and Sydney.",
    icon: "Clock",
    category: "utility",
    parameters: [],
    async execute() {
      const now = new Date();
      const timezones = [
        { label: "Local", tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
        { label: "UTC", tz: "UTC" },
        { label: "Moscow", tz: "Europe/Moscow" },
        { label: "New York", tz: "America/New_York" },
        { label: "London", tz: "Europe/London" },
        { label: "Tokyo", tz: "Asia/Tokyo" },
        { label: "Sydney", tz: "Australia/Sydney" },
      ];

      const lines = timezones.map(({ label, tz }) => {
        const fmt = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          weekday: "short",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        return `  ${label.padEnd(10)} ${fmt.format(now)}`;
      });

      return {
        success: true,
        data: { timestamp: now.toISOString(), timezones },
        display: `Current time:\n${lines.join("\n")}`,
      };
    },
  },

  // 8. file_read
  {
    name: "file_read",
    description:
      "Read the contents of a file at an absolute path. Returns up to 2000 characters.",
    icon: "FileText",
    category: "files",
    parameters: [
      {
        name: "path",
        type: "string",
        required: true,
        description: "Absolute file path to read",
      },
    ],
    async execute(params) {
      const { path } = params;
      if (!path) {
        return {
          success: false,
          data: null,
          display: "Error: path parameter is required.",
          error: "Missing required parameter: path",
        };
      }
      const secErr = validateFilePath(path);
      if (secErr) {
        return { success: false, data: null, display: secErr, error: secErr };
      }
      try {
        let content = await readFile(path, "utf-8");
        if (content.length > 2000) {
          content = content.slice(0, 2000) + "[...truncated]";
        }
        return {
          success: true,
          data: { path, content },
          display: `=== ${path} ===\n${content}`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to read file";
        return {
          success: false,
          data: null,
          display: `Error reading ${path}: ${msg}`,
          error: msg,
        };
      }
    },
  },

  // 9. file_write
  {
    name: "file_write",
    description:
      "Write content to a file at an absolute path. Optionally creates parent directories.",
    icon: "Save",
    category: "files",
    parameters: [
      {
        name: "path",
        type: "string",
        required: true,
        description: "Absolute file path to write",
      },
      {
        name: "content",
        type: "string",
        required: true,
        description: "Content to write to the file",
      },
      {
        name: "createDirs",
        type: "string",
        required: false,
        description: 'Set to "true" to create parent directories if they don\'t exist',
      },
    ],
    async execute(params) {
      const { path, content, createDirs } = params;
      if (!path || !content) {
        return {
          success: false,
          data: null,
          display: "Error: path and content parameters are required.",
          error: "Missing required parameter: path or content",
        };
      }
      const secErr = validateFilePath(path);
      if (secErr) {
        return { success: false, data: null, display: secErr, error: secErr };
      }
      try {
        if (createDirs === "true") {
          await mkdir(path.substring(0, path.lastIndexOf("/")), { recursive: true });
        }
        await writeFile(path, content, "utf-8");
        return {
          success: true,
          data: { path, bytesWritten: content.length },
          display: `Файл ${path} записан (${content.length} символов).`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to write file";
        return {
          success: false,
          data: null,
          display: `Error writing ${path}: ${msg}`,
          error: msg,
        };
      }
    },
  },

  // 10. file_delete
  {
    name: "file_delete",
    description: "Delete a file at an absolute path.",
    icon: "Trash2",
    category: "files",
    parameters: [
      {
        name: "path",
        type: "string",
        required: true,
        description: "Absolute file path to delete",
      },
    ],
    async execute(params) {
      const { path } = params;
      if (!path) {
        return {
          success: false,
          data: null,
          display: "Error: path parameter is required.",
          error: "Missing required parameter: path",
        };
      }
      const secErr = validateFilePath(path);
      if (secErr) {
        return { success: false, data: null, display: secErr, error: secErr };
      }
      if (path.endsWith("/")) {
        return {
          success: false,
          data: null,
          display: "Error: path must not end with '/'. Only files can be deleted.",
          error: "Path must not end with '/', only files can be deleted",
        };
      }
      try {
        try {
          await access(path);
        } catch {
          return {
            success: false,
            data: null,
            display: `Error: file not found: ${path}`,
            error: "File not found",
          };
        }
        await unlink(path);
        return {
          success: true,
          data: { path },
          display: `Файл ${path} удалён.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to delete file";
        return {
          success: false,
          data: null,
          display: `Error deleting ${path}: ${msg}`,
          error: msg,
        };
      }
    },
  },
];

// ─── Formatters ────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes < 1024 * 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

// ─── Public API ────────────────────────────────────────────────

/** Get the full tool registry */
export function getToolRegistry(): AgentTool[] {
  return tools;
}

/** Execute a tool by name */
export async function executeTool(
  name: string,
  params: Record<string, string>
): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return {
      success: false,
      data: null,
      display: `Unknown tool: "${name}"`,
      error: `Tool not found: ${name}`,
    };
  }
  try {
    return await tool.execute(params);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Tool execution failed";
    return {
      success: false,
      data: null,
      display: `Error in ${name}: ${msg}`,
      error: msg,
    };
  }
}

/** Generate a tool definition string for the LLM system prompt */
export function getToolDefinitions(enabledTools?: string[]): string {
  const filtered = enabledTools
    ? tools.filter((t) => enabledTools.includes(t.name))
    : tools;

  if (filtered.length === 0) {
    return "No tools are available.";
  }

  const lines = filtered.map((t) => {
    const paramStr = t.parameters.length > 0
      ? "\n  Parameters:\n" +
        t.parameters
          .map((p) => `    - ${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`)
          .join("\n")
      : "  Parameters: (none)";
    return `## ${t.name}\n${t.description}${paramStr}`;
  });

  return `Available tools:\n\n${lines.join("\n\n")}`;
}