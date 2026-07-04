"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  Snowflake,
  CloudLightning,
  Wind,
  Droplets,
  Gauge,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { publishWeatherUpdate } from "@/lib/context-bus";

// ── Types ─────────────────────────────────────────────────────
interface WeatherCurrent {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  pressure_msl: number;
}

interface WeatherDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
}

interface WeatherData {
  current: WeatherCurrent;
  daily: WeatherDaily;
}

// ── WMO Weather Code → Lucide Icon ────────────────────────────
function weatherIcon(code: number, className = "h-4 w-4") {
  if (code === 0) return <Sun className={className} />;
  if (code >= 1 && code <= 3) return <CloudSun className={className} />;
  if (code === 45 || code === 48) return <CloudFog className={className} />;
  if (code >= 51 && code <= 55) return <CloudDrizzle className={className} />;
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) {
    return <CloudRain className={className} />;
  }
  if (code >= 71 && code <= 77) return <Snowflake className={className} />;
  if (code >= 95 && code <= 99) return <CloudLightning className={className} />;
  return <Cloud className={className} />;
}

// ── Wind direction label ──────────────────────────────────────
function windDir(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

// ── Short day name ────────────────────────────────────────────
function shortDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// ── Main component ────────────────────────────────────────────
export function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);
  // Hydration-safe: always start unlocated (matches SSR and client)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [located, setLocated] = useState(false);

  const prevTempRef = useRef<number | null>(null);

  const fetchWeather = useCallback(async (lat: number, lon: number, signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/jarvis/weather?lat=${lat}&lon=${lon}`, { signal });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
      setError(false);

      // Only fire side effects on first load or when temp actually changes
      const newTemp = Math.round(json.current.temperature_2m);
      if (prevTempRef.current === null || prevTempRef.current !== newTemp) {
        prevTempRef.current = newTemp;
        publishWeatherUpdate({
          temp: json.current.temperature_2m,
          condition: String(json.current.weather_code),
          humidity: json.current.relative_humidity_2m,
          windSpeed: json.current.wind_speed_10m,
          location: "Неизвестно",
        });
        playSound("data-received");
        addActivityEvent({ severity: "success", category: "weather", message: `Погода обновлена: ${newTemp}°C` });
      }
    } catch {
      if (signal?.aborted) return;
      setError(true);
    }
  }, []);

  // Get user location via geolocation API
  useEffect(() => {
    if (located) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocated(true);
      },
      () => {
        // Geolocation denied — fall back to Moscow
        setCoords({ lat: 55.75, lon: 37.62 });
        setLocated(true);
      },
      { timeout: 5000, maximumAge: 300_000 },
    );
  }, [located]);

  // Fetch weather when coords are known, refresh every 10 min
   
  useEffect(() => {
    if (!coords) return;
    const ac = new AbortController();
    void fetchWeather(coords.lat, coords.lon, ac.signal);
    const id = setInterval(() => void fetchWeather(coords.lat, coords.lon, ac.signal), 600_000);
    return () => { ac.abort(); clearInterval(id); };
  }, [coords, fetchWeather]);

  // ── Loading state ──────────────────────────────────────────
  if (!data && !error) {
    return (
      <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CloudSun className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Weather Intelligence
            </span>
          </div>
          <div className="flex h-24 items-center justify-center font-mono text-xs text-muted-foreground">
            <span className="anim-pulse-glow">Scanning atmosphere...</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────
  if (error || !data?.current) {
    return (
      <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm">
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />
        <div className="relative flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CloudSun className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Weather Intelligence
            </span>
          </div>
          <div className="flex h-24 items-center justify-center font-mono text-xs text-muted-foreground">
            UNAVAILABLE
          </div>
        </div>
      </div>
    );
  }

  const { current, daily } = data;
  // Show 5 days starting from tomorrow (skip today which is "current")
  const forecastDays = daily.time.slice(1, 6);

  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/60 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Title */}
        <div className="flex items-center gap-2">
          <CloudSun className="h-4 w-4 text-primary anim-data-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
            Weather Intelligence
          </span>
        </div>

        {/* Current weather */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 pt-1">
            {weatherIcon(current.weather_code, "h-10 w-10 text-primary")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-3xl font-mono font-bold text-foreground">
              {Math.round(current.temperature_2m)}°C
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              Feels like {Math.round(current.apparent_temperature)}°C
              <span className="mx-1.5">·</span>
              <Droplets className="inline h-3 w-3" /> {current.relative_humidity_2m}%
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
              <Wind className="inline h-3 w-3" /> {current.wind_speed_10m} km/h {windDir(current.wind_direction_10m)}
              <span className="mx-1.5">·</span>
              <Gauge className="inline h-3 w-3" /> {Math.round(current.pressure_msl)} hPa
            </div>
          </div>
        </div>

        {/* 5-Day Forecast */}
        {forecastDays.length > 0 && (
          <div className="border-t jarvis-border-cyan pt-2">
            <div className="mb-2 text-center font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              ── 5-Day Forecast ──
            </div>
            <div className="grid grid-cols-5 gap-1 text-center">
              {forecastDays.map((day, i) => {
                const dayIdx = i + 1; // +1 because we sliced from index 1
                return (
                  <motion.div
                    key={day}
                    className="flex flex-col items-center gap-0.5 rounded-md bg-primary/5 py-1.5 transition-colors hover:bg-primary/10"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
                  >
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">
                      {shortDay(day)}
                    </span>
                    <span className="mt-0.5">
                      {weatherIcon(daily.weather_code[dayIdx], "h-4 w-4 text-primary/80")}
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-foreground">
                      {Math.round(daily.temperature_2m_max[dayIdx])}°
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {Math.round(daily.temperature_2m_min[dayIdx])}°
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}