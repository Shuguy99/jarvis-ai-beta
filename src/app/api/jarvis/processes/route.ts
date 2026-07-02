import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

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

// ── Parse `ps aux --sort=-%cpu` output ─────────────────────────
function parsePsAux(sort: string): ProcessInfo[] {
  let sortFlag: string;
  switch (sort) {
    case "mem":
      sortFlag = "--sort=-%mem";
      break;
    case "name":
      sortFlag = "--sort=comm";
      break;
    default:
      sortFlag = "--sort=-%cpu";
  }

  const raw = execSync(`ps aux ${sortFlag}`, {
    encoding: "utf-8",
    timeout: 5000,
  });

  const lines = raw.trim().split("\n");
  // Skip header line
  const rows = lines.slice(1);

  const processes: ProcessInfo[] = [];
  for (const line of rows) {
    // ps aux columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
    const match = line.match(
      /^(\S+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+\d+\s+\d+\s+\S+\s+(\S+)\s+\S+\s+(.+)$/
    );
    if (!match) continue;

    const user = match[1];
    const pid = parseInt(match[2], 10);
    const cpu = parseFloat(match[3]);
    const mem = parseFloat(match[4]);
    const status = match[5];
    const command = match[6].trim();

    // Extract base name from full command path
    const name = command.split("/").pop()?.split(" ")[0] ?? command;
    // Truncate long names
    const displayName = name.length > 24 ? name.slice(0, 22) + "…" : name;

    processes.push({
      pid,
      name: displayName,
      cpu: Math.round(cpu * 10) / 10,
      mem: Math.round(mem * 10) / 10,
      user,
      status,
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
    let processes = parsePsAux(sort);

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
    const body = await request.json();
    const { action, pid } = body as { action?: string; pid?: number };

    if (action !== "kill" || typeof pid !== "number" || pid <= 0) {
      return NextResponse.json(
        { error: "Invalid request. Expected { action: 'kill', pid: number }" },
        { status: 400 }
      );
    }

    // Kill the process
    process.kill(pid, "SIGTERM");

    return NextResponse.json({ success: true, message: `Process ${pid} terminated` });
  } catch (err) {
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