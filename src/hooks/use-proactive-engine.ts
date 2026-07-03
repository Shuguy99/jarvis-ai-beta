"use client";

import { useEffect, useRef, useCallback } from "react";
import { showNotification } from "@/components/jarvis/notification-toast";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { publishProactiveAlert } from "@/lib/context-bus";
import { speakWithJarvisVoice } from "@/lib/tts-utils";

// ── Types ─────────────────────────────────────────────────────

export interface ProactiveEngineConfig {
  enabled: boolean;
  checkIntervalMs: number;
  voiceAlerts: boolean;
  cpuThreshold: number;
  ramThreshold: number;
  diskThreshold: number;
}

interface SystemResponse {
  cpuLoad: number;
  memPct: number;
  diskPct: number;
}

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
}

interface WeatherCurrent {
  temperature_2m: number;
  weather_code: number;
}

interface CalendarEvent {
  id?: string;
  title?: string;
  name?: string;
  date: string;
  endDate?: string;
  [key: string]: unknown;
}

// ── Defaults ──────────────────────────────────────────────────

const DEFAULT_CONFIG: ProactiveEngineConfig = {
  enabled: true,
  checkIntervalMs: 30_000,
  voiceAlerts: true,
  cpuThreshold: 90,
  ramThreshold: 90,
  diskThreshold: 95,
};

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// ── WMO Weather Codes ─────────────────────────────────────────

const RAIN_CODES = new Set([61, 63, 65, 66, 67, 80, 81, 82, 85, 86]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 99]);

function getWeatherCondition(code: number): {
  isRain: boolean;
  isSnow: boolean;
  isStorm: boolean;
  label: string;
  item: string;
} {
  const isRain = RAIN_CODES.has(code);
  const isSnow = SNOW_CODES.has(code);
  const isStorm = STORM_CODES.has(code);

  if (isStorm) return { isRain: false, isSnow: false, isStorm: true, label: "шторм", item: "зонт и остаться дома" };
  if (isSnow) return { isRain: false, isSnow: true, isStorm: false, label: "снегопад", item: "тёплую одежду и зонт" };
  if (isRain) return { isRain: true, isSnow: false, isStorm: false, label: "дождь", item: "зонт" };

  return { isRain: false, isSnow: false, isStorm: false, label: "", item: "" };
}

function isBadWeather(code: number): boolean {
  return RAIN_CODES.has(code) || SNOW_CODES.has(code) || STORM_CODES.has(code);
}

// ── TTS Helper ────────────────────────────────────────────────

function speakAlert(text: string): void {
  speakWithJarvisVoice(text, { rate: 1.0, pitch: 0.9, volume: 0.8 });
}

// ── Calendar Helpers ──────────────────────────────────────────

function getUpcomingCalendarEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem("jarvis-calendar-events");
    if (!raw) return [];
    const events: CalendarEvent[] = JSON.parse(raw);
    const now = Date.now();
    const twoHours = 2 * 60 * 60 * 1000;
    return events.filter((e) => {
      const eventTime = new Date(e.date).getTime();
      return eventTime > now && eventTime - now <= twoHours;
    });
  } catch {
    return [];
  }
}

function formatTimeUntil(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "сейчас";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `через ${mins} мин`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `через ${hrs} ч ${remMins} мин` : `через ${hrs} ч`;
}

// ── Previous State Tracker ────────────────────────────────────

interface PreviousState {
  cpuLoad: number | null;
  memPct: number | null;
  diskPct: number | null;
  lastWeatherCode: number | null;
  lastTemp: number | null;
}

// ── Main Hook ─────────────────────────────────────────────────

/**
 * Proactive Engine — makes JARVIS notice things and tell the user.
 *
 * Unlike `useSystemAlerts` which does raw threshold alerts to the activity
 * feed, this hook provides SMART contextual notifications with process names,
 * weather context, calendar integration, and optional voice alerts.
 */
export function useProactiveEngine(partialConfig?: Partial<ProactiveEngineConfig>): void {
  const configRef = useRef<ProactiveEngineConfig>({
    ...DEFAULT_CONFIG,
    ...partialConfig,
  });

  // Keep config in sync if caller updates it
  useEffect(() => {
    if (partialConfig) {
      configRef.current = { ...DEFAULT_CONFIG, ...partialConfig };
    }
  }, [partialConfig]);

  const prev = useRef<PreviousState>({
    cpuLoad: null,
    memPct: null,
    diskPct: null,
    lastWeatherCode: null,
    lastTemp: null,
  });

  // Cooldown tracking: key → timestamp of last fire
  const cooldowns = useRef<Record<string, number>>({});

  const canFire = useCallback((key: string): boolean => {
    const now = Date.now();
    const last = cooldowns.current[key] ?? 0;
    if (now - last < COOLDOWN_MS) return false;
    cooldowns.current[key] = now;
    return true;
  }, []);

  const checkSystemResources = useCallback(async () => {
    try {
      const [sysRes, procRes] = await Promise.allSettled([
        fetch("/api/jarvis/system", { cache: "no-store" }),
        fetch("/api/jarvis/processes", { cache: "no-store" }),
      ]);

      // Parse system data
      let sysData: SystemResponse | null = null;
      if (sysRes.status === "fulfilled" && sysRes.value.ok) {
        try {
          sysData = await sysRes.value.json();
        } catch {
          /* ignore */
        }
      }

      // Parse process data
      let processes: ProcessInfo[] = [];
      if (procRes.status === "fulfilled" && procRes.value.ok) {
        try {
          const json = await procRes.value.json();
          processes = json.processes ?? [];
        } catch {
          /* ignore */
        }
      }

      if (!sysData) return;

      const prevS = prev.current;

      // ── CPU Threshold (transition-based) ───────────────
      const cpuOver = sysData.cpuLoad >= configRef.current.cpuThreshold;
      const cpuWasUnder = prevS.cpuLoad === null || prevS.cpuLoad < configRef.current.cpuThreshold;

      if (cpuOver && cpuWasUnder && canFire("cpu-high")) {
        // Find top CPU-consuming process
        const sorted = [...processes].sort((a, b) => b.cpu - a.cpu);
        const topProcess = sorted[0];
        const processMsg = topProcess
          ? `Процесс ${topProcess.name} потребляет ${topProcess.cpu}%. Завершить?`
          : "";

        showNotification({
          title: "Сэр, высокая нагрузка на процессор.",
          message: processMsg || undefined,
          type: "warning",
        });
        publishProactiveAlert({
          message: "Сэр, высокая нагрузка на процессор.",
          severity: "warning",
        });

        if (configRef.current.voiceAlerts) {
          speakAlert("Сэр, высокая нагрузка на процессор.");
        }
      }

      // ── RAM Threshold (transition-based) ───────────────
      const ramOver = sysData.memPct >= configRef.current.ramThreshold;
      const ramWasUnder = prevS.memPct === null || prevS.memPct < configRef.current.ramThreshold;

      if (ramOver && ramWasUnder && canFire("ram-high")) {
        const pct = Math.round(sysData.memPct);
        showNotification({
          title: `Сэр, оперативная память почти заполнена (${pct}%).`,
          message: "Рекомендуется закрыть неиспользуемые приложения.",
          type: "warning",
        });
        publishProactiveAlert({
          message: `Сэр, оперативная память почти заполнена (${pct}%).`,
          severity: "warning",
        });

        if (configRef.current.voiceAlerts) {
          speakAlert(`Сэр, оперативная память почти заполнена. ${pct} процентов.`);
        }
      }

      // ── Disk Threshold (transition-based) ──────────────
      const diskOver = sysData.diskPct >= configRef.current.diskThreshold;
      const diskWasUnder = prevS.diskPct === null || prevS.diskPct < configRef.current.diskThreshold;

      if (diskOver && diskWasUnder && canFire("disk-critical")) {
        const pct = Math.round(sysData.diskPct);
        showNotification({
          title: `КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ: Диск заполнен на ${pct}%.`,
          message: "Немедленная очистка рекомендуется.",
          type: "error",
        });
        publishProactiveAlert({
          message: `КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ: Диск заполнен на ${pct}%.`,
          severity: "error",
        });

        if (configRef.current.voiceAlerts) {
          speakAlert(`Критическое предупреждение: диск заполнен на ${pct} процентов. Немедленная очистка рекомендуется.`);
        }
      }

      // Update previous state
      prev.current.cpuLoad = sysData.cpuLoad;
      prev.current.memPct = sysData.memPct;
      prev.current.diskPct = sysData.diskPct;
    } catch {
      /* ignore fetch errors */
    }
  }, [canFire]);

  const checkWeatherAndCalendar = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/weather", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      const current: WeatherCurrent = data.current;
      if (!current) return;

      const temp = current.temperature_2m;
      const code = current.weather_code;
      const condition = getWeatherCondition(code);
      const prevS = prev.current;

      // ── Bad weather (rain/snow/storm) ──────────────────
      if (condition.label && canFire("weather-bad")) {
        showNotification({
          title: `На улице ${condition.label}, сэр.`,
          message: `Советую взять ${condition.item}.`,
          type: "info",
        });
        publishProactiveAlert({
          message: `На улице ${condition.label}, сэр.`,
          severity: "info",
        });

        if (configRef.current.voiceAlerts) {
          speakAlert(`На улице ${condition.label}, сэр. Советую взять ${condition.item}.`);
        }
      }

      // ── High temperature ───────────────────────────────
      const tempHigh = temp > 30;
      const prevTempNormal = prevS.lastTemp === null || prevS.lastTemp <= 30;

      if (tempHigh && prevTempNormal && canFire("temp-high")) {
        showNotification({
          title: `Температура на улице ${Math.round(temp)}°C.`,
          message: "Рекомендуется гидратация.",
          type: "info",
        });
        publishProactiveAlert({
          message: `Температура на улице ${Math.round(temp)}°C.`,
          severity: "info",
        });

        if (configRef.current.voiceAlerts) {
          speakAlert(`Температура на улице ${Math.round(temp)} градусов. Рекомендуется гидратация.`);
        }
      }

      // ── Low temperature ────────────────────────────────
      const tempLow = temp < -10;
      const prevTempWarm = prevS.lastTemp === null || prevS.lastTemp >= -10;

      if (tempLow && prevTempWarm && canFire("temp-low")) {
        showNotification({
          title: `Температура ${Math.round(temp)}°C.`,
          message: "Одевайтесь теплее, сэр.",
          type: "warning",
        });
        publishProactiveAlert({
          message: `Температура ${Math.round(temp)}°C.`,
          severity: "warning",
        });

        if (configRef.current.voiceAlerts) {
          speakAlert(`Температура ${Math.round(temp)} градусов. Одевайтесь теплее, сэр.`);
        }
      }

      // ── Calendar + Weather integration ─────────────────
      if (isBadWeather(code) && canFire("calendar-weather")) {
        const upcomingEvents = getUpcomingCalendarEvents();
        if (upcomingEvents.length > 0) {
          // Only alert about the soonest event
          const event = upcomingEvents[0];
          const eventName = event.title || event.name || "встреча";
          const timeUntil = formatTimeUntil(event.date);

          showNotification({
            title: `Через ${timeUntil} у вас «${eventName}»`,
            message: `На улице ${condition.label || "непогода"} — советую взять зонт и выйти заранее.`,
            type: "warning",
          });
          publishProactiveAlert({
            message: `Через ${timeUntil} у вас «${eventName}»`,
            severity: "warning",
          });

          if (configRef.current.voiceAlerts) {
            speakAlert(`Через ${timeUntil} у вас ${eventName}. На улице ${condition.label} — советую взять зонт и выйти заранее.`);
          }
        }
      }

      // Update previous state
      prev.current.lastWeatherCode = code;
      prev.current.lastTemp = temp;
    } catch {
      /* ignore fetch errors */
    }
  }, [canFire]);

  // ── Main Loop ───────────────────────────────────────────

  useEffect(() => {
    if (!configRef.current.enabled) return;

    let active = true;
    let intervalId: ReturnType<typeof setInterval>;

    const runCycle = async () => {
      if (!active || !configRef.current.enabled) return;
      await checkSystemResources();
      await checkWeatherAndCalendar();
    };

    // Initial check after a short delay to let system settle
    const timeout = setTimeout(() => {
      void runCycle();
      intervalId = setInterval(() => void runCycle(), configRef.current.checkIntervalMs);
    }, 3000);

    // Log engine start
    addActivityEvent({
      message: "Проактивный движок JARVIS активирован",
      severity: "success",
      category: "system",
    });

    return () => {
      active = false;
      clearTimeout(timeout);
      if (intervalId) clearInterval(intervalId);

      addActivityEvent({
        message: "Проактивный движок JARVIS остановлен",
        severity: "info",
        category: "system",
      });
    };
  }, [checkSystemResources, checkWeatherAndCalendar]);
}