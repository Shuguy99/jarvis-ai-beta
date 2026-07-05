import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── agent-tools.ts tests ────────────────────────────────────

import {
  getToolDefinitionsForFunctionCalling,
  executeTool,
  getToolRegistry,
} from "@/lib/agent-tools";

describe("safeEvalMath (via calculator tool)", () => {
  it("basic addition", async () => {
    const result = await executeTool("calculator", { expression: "2 + 3" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("5");
  });

  it("basic subtraction", async () => {
    const result = await executeTool("calculator", { expression: "10 - 4" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("6");
  });

  it("basic multiplication", async () => {
    const result = await executeTool("calculator", { expression: "3 * 7" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("21");
  });

  it("basic division", async () => {
    const result = await executeTool("calculator", { expression: "20 / 4" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("5");
  });

  it("modulo operator", async () => {
    const result = await executeTool("calculator", { expression: "10 % 3" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("1");
  });

  it("nested parentheses", async () => {
    const result = await executeTool("calculator", {
      expression: "((2 + 3) * (4 - 1))",
    });
    expect(result.success).toBe(true);
    expect(result.display).toContain("15");
  });

  it("sin function", async () => {
    const result = await executeTool("calculator", { expression: "sin(0)" });
    expect(result.success).toBe(true);
    // sin(0) = 0
    expect(result.display).toContain("0");
  });

  it("cos function", async () => {
    const result = await executeTool("calculator", { expression: "cos(0)" });
    expect(result.success).toBe(true);
    // cos(0) = 1
    expect(result.display).toContain("1");
  });

  it("sqrt function", async () => {
    const result = await executeTool("calculator", { expression: "sqrt(16)" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("4");
  });

  it("abs function", async () => {
    const result = await executeTool("calculator", { expression: "abs(-42)" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("42");
  });

  it("pow function with two arguments", async () => {
    const result = await executeTool("calculator", { expression: "pow(2, 10)" });
    expect(result.success).toBe(true);
    expect(result.display).toContain("1024");
  });

  it("log function", async () => {
    const result = await executeTool("calculator", { expression: "log(E)" });
    expect(result.success).toBe(true);
    // log(e) = 1
    expect(result.display).toContain("1");
  });

  it("PI constant", async () => {
    const result = await executeTool("calculator", { expression: "PI" });
    expect(result.success).toBe(true);
    // Display is formatted via toFixed(6): "PI = 3.141593"
    expect(result.display).toContain("PI = 3.141593");
  });

  it("E constant", async () => {
    const result = await executeTool("calculator", { expression: "E" });
    expect(result.success).toBe(true);
    // Display is formatted via toFixed(6): "E = 2.718282"
    expect(result.display).toContain("E = 2.718282");
  });

  it("lowercase pi constant", async () => {
    const result = await executeTool("calculator", { expression: "pi" });
    expect(result.success).toBe(true);
    // Display is formatted via toFixed(6): "pi = 3.141593"
    expect(result.display).toContain("pi = 3.141593");
  });

  it("lowercase e constant", async () => {
    const result = await executeTool("calculator", { expression: "e" });
    expect(result.success).toBe(true);
    // Display is formatted via toFixed(6): "e = 2.718282"
    expect(result.display).toContain("e = 2.718282");
  });

  it("expression with spaces and mixed operations", async () => {
    const result = await executeTool("calculator", {
      expression: "  2  +  3  *  4  ",
    });
    expect(result.success).toBe(true);
    // 2 + (3*4) = 14
    expect(result.display).toContain("14");
  });

  it("error on invalid input", async () => {
    const result = await executeTool("calculator", { expression: "abc" });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("error on division by zero", async () => {
    const result = await executeTool("calculator", { expression: "1 / 0" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Division by zero");
  });

  it("error on empty expression", async () => {
    const result = await executeTool("calculator", { expression: "" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Missing required parameter");
  });

  it("error on missing closing parenthesis", async () => {
    const result = await executeTool("calculator", { expression: "(2 + 3" });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("error on unexpected trailing characters", async () => {
    const result = await executeTool("calculator", {
      expression: "2 + 3 abc",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("error on unexpected special character", async () => {
    const result = await executeTool("calculator", { expression: "2 @ 3" });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("getToolDefinitionsForFunctionCalling", () => {
  it("returns an array", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    expect(Array.isArray(defs)).toBe(true);
  });

  it("each item has type:function", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    for (const def of defs) {
      expect(def.type).toBe("function");
    }
  });

  it("each item has function.name and function.description", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    for (const def of defs) {
      expect(typeof def.function.name).toBe("string");
      expect(def.function.name.length).toBeGreaterThan(0);
      expect(typeof def.function.description).toBe("string");
      expect(def.function.description.length).toBeGreaterThan(0);
    }
  });

  it("each item has function.parameters with type:object", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    for (const def of defs) {
      expect(def.function.parameters.type).toBe("object");
    }
  });

  it("each item has function.parameters.properties", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    for (const def of defs) {
      expect(def.function.parameters).toHaveProperty("properties");
      expect(typeof def.function.parameters.properties).toBe("object");
    }
  });

  it("each item has function.parameters.required as array", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    for (const def of defs) {
      expect(Array.isArray(def.function.parameters.required)).toBe(true);
    }
  });

  it("all required fields are present in properties", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    for (const def of defs) {
      for (const req of def.function.parameters.required) {
        expect(def.function.parameters.properties).toHaveProperty(req);
      }
    }
  });

  it("filters by enabled tool names when provided", () => {
    const defs = getToolDefinitionsForFunctionCalling(["calculator", "get_time"]);
    expect(defs).toHaveLength(2);
    const names = defs.map((d) => d.function.name);
    expect(names).toContain("calculator");
    expect(names).toContain("get_time");
  });

  it("returns empty array for non-existent tool names", () => {
    const defs = getToolDefinitionsForFunctionCalling(["nonexistent_tool"]);
    expect(defs).toHaveLength(0);
  });

  it("includes calculator tool with expression parameter", () => {
    const defs = getToolDefinitionsForFunctionCalling();
    const calc = defs.find((d) => d.function.name === "calculator");
    expect(calc).toBeDefined();
    expect(calc!.function.parameters.properties).toHaveProperty("expression");
    expect(calc!.function.parameters.required).toContain("expression");
  });
});

describe("executeTool — calculator", () => {
  it("valid expression returns success", async () => {
    const result = await executeTool("calculator", {
      expression: "2 + 2",
    });
    expect(result.success).toBe(true);
    expect(result.display).toContain("4");
    expect(result.data).not.toBeNull();
  });

  it("invalid expression returns error", async () => {
    const result = await executeTool("calculator", {
      expression: "!!!invalid!!!",
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.display).toContain("Error");
  });

  it("unknown tool returns error", async () => {
    const result = await executeTool("nonexistent_tool", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool not found");
  });
});

describe("getToolRegistry", () => {
  it("returns all built-in tools", () => {
    const registry = getToolRegistry();
    expect(registry.length).toBeGreaterThan(0);
    const names = registry.map((t) => t.name);
    expect(names).toContain("calculator");
    expect(names).toContain("get_time");
    expect(names).toContain("web_search");
    expect(names).toContain("get_weather");
    expect(names).toContain("file_list");
    expect(names).toContain("file_read");
    expect(names).toContain("file_write");
    expect(names).toContain("file_delete");
    expect(names).toContain("system_info");
    expect(names).toContain("system_processes");
  });

  it("each tool has required shape", () => {
    const registry = getToolRegistry();
    for (const tool of registry) {
      expect(typeof tool.name).toBe("string");
      expect(typeof tool.description).toBe("string");
      expect(typeof tool.icon).toBe("string");
      expect(["system", "web", "files", "analysis", "utility"]).toContain(
        tool.category
      );
      expect(Array.isArray(tool.parameters)).toBe(true);
      expect(typeof tool.execute).toBe("function");
    }
  });
});

// ─── Agent route (POST / GET) ────────────────────────────────

describe("POST /api/jarvis/agent", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 400 when message is missing", async () => {
    const { POST } = await import(
      "@/app/api/jarvis/agent/route"
    );

    const req = new Request("http://localhost/api/jarvis/agent", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json", "content-length": "2" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Message is required");
  });

  it("returns 400 when message is empty string", async () => {
    const { POST } = await import(
      "@/app/api/jarvis/agent/route"
    );

    const req = new Request("http://localhost/api/jarvis/agent", {
      method: "POST",
      body: JSON.stringify({ message: "   " }),
      headers: {
        "content-type": "application/json",
        "content-length": "18",
      },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("Message is required");
  });
});

describe("GET /api/jarvis/agent", () => {
  it("returns health check with online:true and maxIterations:10", async () => {
    const { GET } = await import(
      "@/app/api/jarvis/agent/route"
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.online).toBe(true);
    expect(body.maxIterations).toBe(10);
    expect(body.functionCalling).toBe(true);
    expect(body.name).toContain("J.A.R.V.I.S");
  });
});

// ─── Agent stream route (POST) ───────────────────────────────

describe("POST /api/jarvis/agent/stream", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 400 when task is missing", async () => {
    const { POST } = await import(
      "@/app/api/jarvis/agent/stream/route"
    );

    const req = new Request("http://localhost/api/jarvis/agent/stream", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json", "content-length": "2" },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Task required");
  });

  it("returns 400 when task is whitespace only", async () => {
    const { POST } = await import(
      "@/app/api/jarvis/agent/stream/route"
    );

    const req = new Request("http://localhost/api/jarvis/agent/stream", {
      method: "POST",
      body: JSON.stringify({ task: "   " }),
      headers: {
        "content-type": "application/json",
        "content-length": "18",
      },
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Task required");
  });

  it("valid request returns SSE content-type headers", async () => {
    const { POST } = await import(
      "@/app/api/jarvis/agent/stream/route"
    );

    const req = new Request("http://localhost/api/jarvis/agent/stream", {
      method: "POST",
      body: JSON.stringify({ task: "What time is it?" }),
      headers: {
        "content-type": "application/json",
        "content-length": "28",
      },
    });

    const res = await POST(req as never);
    // The response should be a streaming response with SSE headers
    expect(res.status).toBe(200);
    const contentType = res.headers.get("Content-Type");
    expect(contentType).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Connection")).toBe("keep-alive");
  });
});