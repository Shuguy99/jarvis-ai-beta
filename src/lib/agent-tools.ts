/**
 * JARVIS Agent Tool Registry
 *
 * Defines built-in tools the agent can invoke during task execution.
 * Each tool has a name, description, icon, category, parameter schema,
 * and an async execute function.
 */

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
  execute: (params: Record<string, string>) => Promise<ToolResult>;
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

      // Security: only allow numbers, operators, parentheses, whitespace,
      // commas, dots, and known function names / constants
      const allowed = /^[0-9+\-*/%.() \t,]*$|^(sin|cos|tan|sqrt|abs|log|log2|log10|exp|pow|ceil|floor|round|min|max|PI|E|\d|[\s+\-*/%.(),])+$/.test(
        expr
      );

      if (!allowed) {
        return {
          success: false,
          data: null,
          display: `Error: unsafe expression rejected: "${expr}"`,
          error: "Expression contains disallowed characters",
        };
      }

      try {
        // Safe evaluation using Function constructor with only Math available
        const fn = new Function(
          "sin",
          "cos",
          "tan",
          "sqrt",
          "abs",
          "log",
          "log2",
          "log10",
          "exp",
          "pow",
          "ceil",
          "floor",
          "round",
          "min",
          "max",
          "PI",
          "E",
          `"use strict"; return (${expr});`
        );
        const result = fn(
          Math.sin,
          Math.cos,
          Math.tan,
          Math.sqrt,
          Math.abs,
          Math.log,
          Math.log2,
          Math.log10,
          Math.exp,
          Math.pow,
          Math.ceil,
          Math.floor,
          Math.round,
          Math.min,
          Math.max,
          Math.PI,
          Math.E
        );
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
];

// ─── Formatters ────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes < 1024 * 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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