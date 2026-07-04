import { json } from "@/lib/json-response";
import { execFile as cpExecFile } from "child_process";
import { promisify } from "util";
const execFile = promisify(cpExecFile);
import { parseJsonBody, BodyLimitError } from "@/lib/body-limit";

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  user: string;
  status: string;
}

async function parsePsAux(sort: string): Promise<ProcessInfo[]> {
  let sortArg: string;
  switch (sort) {
    case "mem":
      sortArg = "--sort=-%mem";
      break;
    case "name":
      sortArg = "--sort=comm";
      break;
    default:
      sortArg = "--sort=-%cpu";
  }

  let raw: string;
  try {
    const args = ["-o", "pid,comm,%cpu,%mem", sortArg];
    const { stdout } = await execFile("ps", args, {
      timeout: 5000,
      env: { ...process.env, LC_ALL: "C" },
      maxBuffer: 1024 * 1024,
    });
    raw = stdout;
  } catch {
    return [];
  }

  const lines = raw.trim().split("\n");
  const rows = lines.slice(1);

  const processes: ProcessInfo[] = [];
  for (const line of rows) {
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)$/);
    if (!match) continue;

    const pid = parseInt(match[1], 10);
    const cpu = parseFloat(match[3]);
    const mem = parseFloat(match[4]);
    const rawName = match[2].trim();

    const name = rawName.split("/").pop()?.split(" ")[0] ?? rawName;
    const sanitized = name.replace(/[\x00-\x1F\x7F]/g, "").trim();
    const displayName = sanitized.length > 24 ? sanitized.slice(0, 22) + "…" : sanitized;

    processes.push({
      pid,
      name: displayName,
      cpu: Math.round(cpu * 10) / 10,
      mem: Math.round(mem * 10) / 10,
      user: "",
      status: "",
    });

    if (processes.length >= 20) break;
  }

  return processes;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort = url.searchParams.get("sort") ?? "cpu";
  const order = url.searchParams.get("order") ?? "desc";
  const filter = url.searchParams.get("filter")?.toLowerCase() ?? "";

  try {
    let processes = await parsePsAux(sort);

    if (filter) {
      processes = processes.filter(
        (p) =>
          p.name.toLowerCase().includes(filter) ||
          p.user.toLowerCase().includes(filter) ||
          String(p.pid).includes(filter)
      );
    }

    if (order === "asc") {
      processes = [...processes].reverse();
    }

    return json({ processes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json(
      { error: "Failed to fetch processes", details: message },
      500
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<{ action?: string; pid?: number }>(request);
    const { action, pid } = body;

    if (action !== "kill" || typeof pid !== "number" || pid <= 0) {
      return json(
        { error: "Invalid request. Expected { action: 'kill', pid: number }" },
        400
      );
    }

    const FORBIDDEN_PIDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    if (pid <= 10 || FORBIDDEN_PIDS.has(pid)) {
      return json(
        { error: `Permission denied — cannot kill PID ${pid} (protected system process)` },
        403
      );
    }

    process.kill(pid, "SIGTERM");

    return json({ success: true, message: `Process ${pid} terminated` });
  } catch (err) {
    if (err instanceof BodyLimitError) {
      return json({ error: err.message }, 413);
    }
    if (err && typeof err === "object" && "code" in err && err.code === "ESRCH") {
      return json(
        { error: `Process not found: PID does not exist` },
        404
      );
    }
    if (err && typeof err === "object" && "code" in err && err.code === "EPERM") {
      return json(
        { error: "Permission denied — cannot kill this process" },
        403
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return json(
      { error: "Failed to kill process", details: message },
      500
    );
  }
}