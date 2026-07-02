import { NextResponse } from "next/server";
import os from "os";

export const runtime = "nodejs";

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
  });
}
