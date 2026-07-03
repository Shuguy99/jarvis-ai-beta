"use client";

import { useEffect, useRef, useCallback } from "react";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { useSystemData } from "@/hooks/use-system-poller";

const ALERT_THRESHOLDS = {
  cpuWarn: 75,
  cpuCrit: 90,
  memWarn: 80,
  memCrit: 92,
  diskWarn: 85,
  tempWarn: 75,
  tempCrit: 85,
};

// Track which alerts have been fired to avoid spam
const firedAlerts = new Set<string>();
const ALERT_COOLDOWN = 120_000; // 2 minutes between repeated alerts

export function useSystemAlerts() {
  const { system } = useSystemData();
  const lastAlertTime = useRef<Record<string, number>>({});
  const prevData = useRef<{
    cpuLoad: number;
    memPct: number;
    diskPct: number;
    temp: number;
  } | null>(null);

  const canFire = useCallback((key: string): boolean => {
    const now = Date.now();
    const last = lastAlertTime.current[key] ?? 0;
    if (now - last < ALERT_COOLDOWN) return false;
    lastAlertTime.current[key] = now;
    return true;
  }, []);

  useEffect(() => {
    if (!system) return;
    const data = system;

    // CPU alerts
    if (data.cpuLoad >= ALERT_THRESHOLDS.cpuCrit && canFire("cpu-crit")) {
      addActivityEvent({
        message: `CPU критический: ${data.cpuLoad}% — рекомендуется закрыть ресурсоёмкие процессы`,
        severity: "error",
        category: "system",
      });
    } else if (data.cpuLoad >= ALERT_THRESHOLDS.cpuWarn && canFire("cpu-warn")) {
      addActivityEvent({
        message: `CPU нагрузка повышена: ${data.cpuLoad}%`,
        severity: "warning",
        category: "system",
      });
    }

    // RAM alerts
    if (data.memPct >= ALERT_THRESHOLDS.memCrit && canFire("mem-crit")) {
      addActivityEvent({
        message: `Память критическая: ${data.memPct}% — система может стать нестабильной`,
        severity: "error",
        category: "system",
      });
    } else if (data.memPct >= ALERT_THRESHOLDS.memWarn && canFire("mem-warn")) {
      addActivityEvent({
        message: `Использование RAM: ${data.memPct}%`,
        severity: "warning",
        category: "system",
      });
    }

    // Disk alerts
    if (data.diskPct >= ALERT_THRESHOLDS.diskWarn && canFire("disk-warn")) {
      addActivityEvent({
        message: `Диск заполнен на ${data.diskPct}% — рекомендуется очистка`,
        severity: "warning",
        category: "system",
      });
    }

    // Temperature alerts
    if (data.temp >= ALERT_THRESHOLDS.tempCrit && canFire("temp-crit")) {
      addActivityEvent({
        message: `Температура критическая: ${data.temp}°C — риск термального троттлинга`,
        severity: "error",
        category: "system",
      });
    } else if (data.temp >= ALERT_THRESHOLDS.tempWarn && canFire("temp-warn")) {
      addActivityEvent({
        message: `Температура повышена: ${data.temp}°C`,
        severity: "warning",
        category: "system",
      });
    }

    // Recovery alerts (value dropped below threshold)
    if (prevData.current) {
      const prev = prevData.current;
      if (prev.cpuLoad >= ALERT_THRESHOLDS.cpuWarn && data.cpuLoad < ALERT_THRESHOLDS.cpuWarn - 10 && canFire("cpu-recovery")) {
        addActivityEvent({
          message: `CPU нагрузка нормализована: ${data.cpuLoad}%`,
          severity: "success",
          category: "system",
        });
      }
      if (prev.memPct >= ALERT_THRESHOLDS.memWarn && data.memPct < ALERT_THRESHOLDS.memWarn - 5 && canFire("mem-recovery")) {
        addActivityEvent({
          message: `Использование RAM снижено: ${data.memPct}%`,
          severity: "success",
          category: "system",
        });
      }
    }

    prevData.current = { cpuLoad: data.cpuLoad, memPct: data.memPct, diskPct: data.diskPct, temp: data.temp };
  }, [system, canFire]);
}