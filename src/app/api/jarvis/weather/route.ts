import { NextRequest, NextResponse } from "next/server";

// ── In-memory cache (10 min TTL) ──────────────────────────────
interface CacheEntry {
  data: unknown;
  ts: number;
}
let cache: CacheEntry | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const DEFAULT_LAT = 55.75;
const DEFAULT_LON = 37.62;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat")) || DEFAULT_LAT;
  const lon = Number(searchParams.get("lon")) || DEFAULT_LON;

  const cacheKey = `${lat}:${lon}`;
  if (cache && cache.ts + CACHE_TTL > Date.now() && (cache.data as Record<string, unknown>)?._ck === cacheKey) {
    return NextResponse.json(cache.data);
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
    // Stamp with cache key so we don't serve stale data for different coords
    (data as Record<string, unknown>)._ck = cacheKey;

    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to reach Open-Meteo API" },
      { status: 502 },
    );
  }
}