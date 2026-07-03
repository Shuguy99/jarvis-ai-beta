import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ── In-memory cache keyed by location (10 min TTL) ─────────
interface CacheEntry {
  data: unknown;
  ts: number;
}
const cacheMap = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const DEFAULT_LAT = 55.75;
const DEFAULT_LON = 37.62;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Fix: use null check instead of falsy || to handle lat/lon of 0
  const rawLat = searchParams.get("lat");
  const rawLon = searchParams.get("lon");
  const lat = rawLat !== null ? Number(rawLat) : DEFAULT_LAT;
  const lon = rawLon !== null ? Number(rawLon) : DEFAULT_LON;

  const cacheKey = `${lat}:${lon}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && cached.ts + CACHE_TTL > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "7",
  });

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      headers: { "User-Agent": "JARVIS-Weather-Proxy/1.0" },
      next: { revalidate: 600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    cacheMap.set(cacheKey, { data, ts: Date.now() });

    // Evict stale entries to prevent unbounded growth
    const now = Date.now();
    for (const [key, entry] of cacheMap) {
      if (entry.ts + CACHE_TTL < now) cacheMap.delete(key);
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Open-Meteo API" },
      { status: 502 },
    );
  }
}