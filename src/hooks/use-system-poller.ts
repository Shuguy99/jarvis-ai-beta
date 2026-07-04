

import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────

export interface SystemNetworkInterface {
  name: string;
  family: string;
  address: string;
  internal: boolean;
}

export interface SystemProcessMemory {
  rss: number;
  heapUsed: number;
  heapTotal: number;
}

export interface SystemCoreInfo {
  id: number;
  load: number;
}

/** Full shape returned by GET /api/jarvis/system */
export interface SystemData {
  hostname: string;
  platform: string;
  arch: string;
  cpus: number;
  cpuModel: string;
  cpuLoad: number;
  memPct: number;
  memUsed: number;
  memTotal: number;
  netThroughput: number;
  netSpeedIn: number;
  netSpeedOut: number;
  processes: number;
  temp: number;
  uptime: number;
  loadAvg: number[];
  timestamp: string;
  cores: SystemCoreInfo[];
  diskTotal: number;
  diskUsed: number;
  diskPct: number;
  networkInterfaces: SystemNetworkInterface[];
  processMemory: SystemProcessMemory;
}

/** Shape of a single process from GET /api/jarvis/processes */
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  user: string;
  status: string;
}

// ── Module-level cache & pub/sub ───────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedSystemData: SystemData | null = null;
let cachedProcessData: ProcessInfo[] | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let fetchInProgress = false;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): {
  system: SystemData | null;
  processes: ProcessInfo[] | null;
} {
  return { system: cachedSystemData, processes: cachedProcessData };
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

async function fetchData(): Promise<void> {
  if (fetchInProgress) return;
  fetchInProgress = true;
  try {
    const [systemRes, processesRes] = await Promise.allSettled([
      fetch("/api/jarvis/system", { cache: "no-store" }),
      fetch("/api/jarvis/processes", { cache: "no-store" }),
    ]);

    if (systemRes.status === "fulfilled" && systemRes.value.ok) {
      try {
        cachedSystemData = await systemRes.value.json();
      } catch {
        /* invalid JSON — ignore */
      }
    }

    if (processesRes.status === "fulfilled" && processesRes.value.ok) {
      try {
        const json = await processesRes.value.json();
        cachedProcessData = json.processes ?? null;
      } catch {
        /* invalid JSON — ignore */
      }
    }

    notifyListeners();
  } finally {
    fetchInProgress = false;
  }
}

function startPolling(): void {
  if (!intervalId) {
    void fetchData();
    intervalId = setInterval(() => void fetchData(), 5000);
  }
}

/**
 * Force an immediate fetch outside the normal polling cycle.
 * Useful for diagnostics / manual refresh buttons.
 */
export function refreshSystemData(): Promise<void> {
  fetchInProgress = false;
  return fetchData();
}

// ── Hook ───────────────────────────────────────────────────────

/**
 * Returns reactively-updated system and process data from a single
 * shared polling interval (5 s).  Multiple consumers receive the
 * same cached objects — only one set of HTTP requests is ever in
 * flight at a time.
 */
export function useSystemData(): {
  system: SystemData | null;
  processes: ProcessInfo[] | null;
} {
  const [data, setData] = useState(getSnapshot);

  useEffect(() => {
    startPolling();
    const unsubscribe = subscribe(() => setData(getSnapshot()));
    return unsubscribe;
  }, []);

  return data;
}