import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { execFile as cpExecFile } from "child_process";
import { promisify } from "util";
const execFile = promisify(cpExecFile);
import { parseJsonBody, BodyLimitError } from "@/lib/body-limit";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────
interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  user: string;
  status: string;
}

// ── Parse `ps -o pid,comm,%cpu,%mem,etime,args --sort=…` output ──
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
  // Skip header line
  const rows = lines.slice(1);

  const processes: ProcessInfo[] = [];
  for (const line of rows) {
    // ps -o pid,comm,%cpu,%mem columns:
    //   PID COMMAND         %CPU %MEM
    // Groups: 1=PID, 2=COMMAND, 3=%CPU, 4=%MEM
    const match = line.match(/^\s*(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)$/);
    if (!match) continue;

    const pid = parseInt(match[1], 10);
    const cpu = parseFloat(match[3]);
    const mem = parseFloat(match[4]);
    const rawName = match[2].trim();

    // Extract base name from full command path
    const name = rawName.split("/").pop()?.split(" ")[0] ?? rawName;
    // Sanitize: replace non-printable chars
    const sanitized = name.replace(/[\x00-\x1F\x7F]/g, "").trim();
    // Truncate long names
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

// ── GET: Fetch top processes ──────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const sort = searchParams.get("sort") ?? "cpu"; // cpu | mem | name
  const order = searchParams.get("order") ?? "desc"; // desc | asc
  const filter = searchParams.get("filter")?.toLowerCase() ?? "";

  try {
    let processes = await parsePsAux(sort);

    // Apply text filter
    if (filter) {
      processes = processes.filter(
        (p) =>
          p.name.toLowerCase().includes(filter) ||
          p.user.toLowerCase().includes(filter) ||
          String(p.pid).includes(filter)
      );
    }

    // Apply order (ps sort already handles direction for cpu/mem/name)
    if (order === "asc") {
      processes = [...processes].reverse();
    }

    return NextResponse.json({ processes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch processes", details: message },
      { status: 500 }
    );
  }
}

// ── POST: Kill a process ──────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody<{ action?: string; pid?: number }>(request);
    const { action, pid } = body;

    if (action !== "kill" || typeof pid !== "number" || pid <= 0) {
      return NextResponse.json(
        { error: "Invalid request. Expected { action: 'kill', pid: number }" },
        { status: 400 }
      );
    }

    // Block killing critical system processes
    const FORBIDDEN_PIDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    if (pid <= 10 || FORBIDDEN_PIDS.has(pid)) {
      return NextResponse.json(
        { error: `Permission denied — cannot kill PID ${pid} (protected system process)` },
        { status: 403 }
      );
    }

    // Kill the process
    process.kill(pid, "SIGTERM");

    return NextResponse.json({ success: true, message: `Process ${pid} terminated` });
  } catch (err) {
    if (err instanceof BodyLimitError) {
      return NextResponse.json({ error: err.message }, { status: 413 });
    }
    if (err && typeof err === "object" && "code" in err && err.code === "ESRCH") {
      return NextResponse.json(
        { error: `Process not found: PID does not exist` },
        { status: 404 }
      );
    }
    if (err && typeof err === "object" && "code" in err && err.code === "EPERM") {
      return NextResponse.json(
        { error: "Permission denied — cannot kill this process" },
        { status: 403 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to kill process", details: message },
      { status: 500 }
    );
  }
}