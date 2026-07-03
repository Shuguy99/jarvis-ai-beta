import { NextResponse } from "next/server";
import os from "os";
import { readFile, statfs } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

interface NetworkInterfaceInfo {
  name: string;
  family: "IPv4" | "IPv6";
  address: string;
  internal: boolean;
}

// ── Real network throughput measurement via /proc/net/dev ─────
interface NetCounters {
  rxBytes: number;
  txBytes: number;
  timestamp: number;
}

let prevCounters: NetCounters | null = null;

/**
 * Read cumulative byte counters from /proc/net/dev (Linux only).
 * Sums all non-loopback interfaces. Falls back to null if unavailable.
 */
async function readProcNetDev(): Promise<{ rxBytes: number; txBytes: number } | null> {
  try {
    const content = await readFile("/proc/net/dev", "utf-8");
    let totalRx = 0;
    let totalTx = 0;
    for (const line of content.split("\n")) {
      const match = line.match(/^\s*(\w+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (!match) continue;
      const iface = match[1];
      if (iface === "lo") continue; // skip loopback
      totalRx += parseInt(match[2], 10);
      totalTx += parseInt(match[3], 10);
    }
    return { rxBytes: totalRx, txBytes: totalTx };
  } catch {
    return null;
  }
}

/**
 * Compute network throughput in Mbps (megabits per second).
 * Uses delta of byte counters between consecutive calls.
 * Falls back to simulated values if real counters are unavailable.
 */
async function getNetworkThroughput(): Promise<{ netSpeedIn: number; netSpeedOut: number }> {
  const current = await readProcNetDev();
  const now = Date.now();

  if (current && prevCounters) {
    const dtSec = (now - prevCounters.timestamp) / 1000;
    if (dtSec > 0.05) { // at least 50ms between samples
      const rxDelta = Math.max(0, current.rxBytes - prevCounters.rxBytes);
      const txDelta = Math.max(0, current.txBytes - prevCounters.txBytes);
      // Convert bytes to megabits: bytes * 8 / 1_000_000
      const netSpeedIn = Math.round((rxDelta * 8) / (dtSec * 1_000_000) * 100) / 100;
      const netSpeedOut = Math.round((txDelta * 8) / (dtSec * 1_000_000) * 100) / 100;
      prevCounters = { rxBytes: current.rxBytes, txBytes: current.txBytes, timestamp: now };
      return { netSpeedIn, netSpeedOut };
    }
  }

  // Update stored counters for next call
  if (current) {
    prevCounters = { rxBytes: current.rxBytes, txBytes: current.txBytes, timestamp: now };
  }

  // Fallback: no /proc/net/dev available (non-Linux or container)
  // Return zeros — the dashboard handles 0 gracefully
  return { netSpeedIn: 0, netSpeedOut: 0 };
}

/**
 * Try to get disk stats using fs.promises.statfs (Node 18.15+ / Node 20+ on Windows).
 * Falls back to simulated data.
 */
async function getDiskStats(): Promise<{ diskTotal: number; diskUsed: number; diskPct: number }> {
  try {
    // statfs requires a path — use the project root or OS temp
    const targetPath = path.resolve("/");
    const stats = await statfs(targetPath) as { bsize: number; blocks: number; bfree: number; bavail: number };
    const total = Number(stats.bsize) * Number(stats.blocks);
    const free = Number(stats.bsize) * Number(stats.bfree);
    const used = total - free;
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    return { diskTotal: total, diskUsed: used, diskPct: pct };
  } catch {
    // Fallback: statfs unavailable — return zeros
    return { diskTotal: 0, diskUsed: 0, diskPct: 0 };
  }
}

/**
 * Get active, non-internal network interfaces (max 3).
 */
function getNetworkInterfaces(): NetworkInterfaceInfo[] {
  const ifaces = os.networkInterfaces();
  const result: NetworkInterfaceInfo[] = [];

  for (const [name, entries] of Object.entries(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.internal) continue;
      // Prefer IPv4; include IPv6 only if few entries
      if (entry.family === "IPv4" || result.length < 2) {
        result.push({
          name,
          family: entry.family as "IPv4" | "IPv6",
          address: entry.address,
          internal: entry.internal,
        });
      }
      if (result.length >= 3) break;
    }
    if (result.length >= 3) break;
  }

  return result;
}

/**
 * GET /api/jarvis/system
 * Returns simulated + real host metrics for the HUD dashboard.
 */
export async function GET() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const loadAvg = os.loadavg();
  const uptime = os.uptime();

  // Real CPU load from OS load average
  const cpuLoad = Math.min(
    100,
    Math.max(0, Math.round((loadAvg[0] / cpus.length) * 100))
  );
  const memPct = Math.round((usedMem / totalMem) * 100);
  // Network throughput (real or simulated)
  const { netSpeedIn, netSpeedOut } = await getNetworkThroughput();
  const netThroughput = Math.round(netSpeedIn + netSpeedOut);

  // Disk + network interfaces + process memory
  const disk = await getDiskStats();
  let processes = 0;
  try {
    const { execFile: cpExec } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(cpExec);
    const { stdout } = await execFileAsync("sh", ["-c", "ls -1 /proc | grep -c '^[0-9]'"], { timeout: 3000 });
    processes = parseInt(stdout.trim(), 10) || 0;
  } catch {
    // Fallback: approximate from load average heuristic
    processes = Math.round(loadAvg[0] * 10) + 50;
  }
  // Temperature from /sys/class/thermal (Linux) or fallback estimate
  let temp = 0;
  try {
    const tempContent = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf-8");
    temp = Math.round(parseInt(tempContent.trim(), 10) / 1000);
  } catch {
    // Fallback: estimate from CPU load (higher load ≈ higher temp)
    temp = Math.round(35 + cpuLoad * 0.4);
  }

  // Network interfaces + process memory
  const networkInterfaces = getNetworkInterfaces();
  const memUsage = process.memoryUsage();
  const processMemory = {
    rss: memUsage.rss,
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
  };

  return NextResponse.json({
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpus: cpus.length,
    cpuModel: cpus[0]?.model ?? "Unknown",
    cpuLoad,
    memPct,
    memUsed: usedMem,
    memTotal: totalMem,
    netThroughput,
    netSpeedIn,
    netSpeedOut,
    processes,
    temp,
    uptime,
    loadAvg: loadAvg.map((n) => Number(n.toFixed(2))),
    timestamp: new Date().toISOString(),
    cores: cpus.map((c, i) => ({
      id: i,
      load: Math.min(100, Math.max(0, Math.round(cpuLoad + (Math.random() - 0.5) * 10))),
    })),
    // New fields
    ...disk,
    networkInterfaces,
    processMemory,
  });
}
