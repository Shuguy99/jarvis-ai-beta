import { NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

interface NetworkInterfaceInfo {
  name: string;
  family: "IPv4" | "IPv6";
  address: string;
  internal: boolean;
}

/**
 * Try to get disk stats using fs.promises.statfs (Node 18.15+ / Node 20+ on Windows).
 * Falls back to simulated data.
 */
async function getDiskStats(): Promise<{ diskTotal: number; diskUsed: number; diskPct: number }> {
  try {
    // statfs requires a path — use the project root or OS temp
    const targetPath = path.resolve("/");
    const stats = await (fs.promises as typeof fs.promises & { statfs(p: string): Promise<{ bsize: number; blocks: number; bfree: number }> }).statfs(targetPath);
    const total = Number(stats.bsize) * Number(stats.blocks);
    const free = Number(stats.bsize) * Number(stats.bfree);
    const used = total - free;
    const pct = total > 0 ? Math.round((used / total) * 100) : 0;
    return { diskTotal: total, diskUsed: used, diskPct: pct };
  } catch {
    // Fallback: simulated disk data
    const t = Date.now() / 1000;
    const diskTotal = 500_107_862_016; // ~465 GB
    const diskUsed = 234_881_024_000 + Math.round(Math.sin(t / 30) * 2_000_000_000);
    const diskPct = Math.round((diskUsed / diskTotal) * 100);
    return { diskTotal, diskUsed: diskPct, diskPct };
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

  // Smoothed pseudo-metrics for the HUD feel
  const t = Date.now() / 1000;
  const cpuLoad = Math.min(
    100,
    Math.max(2, Math.round((loadAvg[0] / cpus.length) * 100 + Math.sin(t / 5) * 8 + 12))
  );
  const memPct = Math.round((usedMem / totalMem) * 100);
  const netThroughput = Math.round(40 + Math.abs(Math.sin(t / 3)) * 160); // Mbps
  const processes = 120 + Math.round(Math.abs(Math.sin(t / 7)) * 40);
  const temp = Math.round(42 + Math.abs(Math.sin(t / 9)) * 18); // °C

  // New data
  const disk = await getDiskStats();
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
    processes,
    temp,
    uptime,
    loadAvg: loadAvg.map((n) => Number(n.toFixed(2))),
    timestamp: new Date().toISOString(),
    cores: cpus.map((c, i) => ({
      id: i,
      load: Math.min(100, Math.max(0, Math.round(cpuLoad + Math.sin(t / 2 + i) * 25))),
    })),
    // New fields
    ...disk,
    networkInterfaces,
    processMemory,
  });
}
