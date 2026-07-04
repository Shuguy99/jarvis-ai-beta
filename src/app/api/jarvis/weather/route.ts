import { json } from "@/lib/json-response";

interface CacheEntry {
  data: unknown;
  ts: number;
}
const cacheMap = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000;

const DEFAULT_LAT = 55.75;
const DEFAULT_LON = 37.62;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const rawLat = searchParams.get("lat");
  const rawLon = searchParams.get("lon");
  const lat = rawLat !== null ? Number(rawLat) : DEFAULT_LAT;
  const lon = rawLon !== null ? Number(rawLon) : DEFAULT_LON;

  const cacheKey = `${lat}:${lon}`;
  const cached = cacheMap.get(cacheKey);
  if (cached && cached.ts + CACHE_TTL > Date.now()) {
    return json(cached.data);
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
    });

    if (!res.ok) {
      return json({ error: `Upstream returned ${res.status}` }, 502);
    }

    const data = await res.json();
    cacheMap.set(cacheKey, { data, ts: Date.now() });

    const now = Date.now();
    for (const [key, entry] of cacheMap) {
      if (entry.ts + CACHE_TTL < now) cacheMap.delete(key);
    }

    return json(data);
  } catch {
    return json({ error: "Failed to reach Open-Meteo API" }, 502);
  }
}