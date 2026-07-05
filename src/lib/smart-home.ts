// JARVIS Smart Home Integration — Home Assistant / MQTT service
// Local CRUD via localStorage, HA REST API proxy, MQTT stubs

// ── Types ─────────────────────────────────────────────────────

export interface SmartDevice {
  id: string;
  name: string;
  type: "light" | "switch" | "sensor" | "thermostat" | "camera" | "lock" | "speaker" | "other";
  room: string;
  state: "on" | "off" | "unknown";
  attributes: Record<string, unknown>; // brightness, temperature, humidity, etc.
  icon: string; // emoji
  lastUpdated: string;
}

export interface HomeAssistantConfig {
  enabled: boolean;
  url: string;        // e.g. http://192.168.1.100:8123
  token: string;      // Long-lived access token
  autoDiscover: boolean;
}

export interface MQTTConfig {
  enabled: boolean;
  broker: string;     // e.g. mqtt://192.168.1.100:1883
  username?: string;
  password?: string;
}

// ── Constants ─────────────────────────────────────────────────

export const ROOMS = [
  "Гостиная",
  "Спальня",
  "Кухня",
  "Ванная",
  "Коридор",
  "Офис",
  "Гараж",
] as const;

export const DEVICE_TEMPLATES: Omit<SmartDevice, "id" | "lastUpdated">[] = [
  { name: "Основной свет", type: "light", room: "Гостиная", state: "off", attributes: { brightness: 100 }, icon: "💡" },
  { name: "Торшер", type: "light", room: "Гостиная", state: "off", attributes: { brightness: 60 }, icon: "🪔" },
  { name: "Телевизор", type: "switch", room: "Гостиная", state: "off", attributes: {}, icon: "📺" },
  { name: "Настольная лампа", type: "light", room: "Спальня", state: "off", attributes: { brightness: 40 }, icon: "💡" },
  { name: "Ночник", type: "light", room: "Спальня", state: "off", attributes: { brightness: 10 }, icon: "🌙" },
  { name: "Умная розетка", type: "switch", room: "Спальня", state: "off", attributes: {}, icon: "🔌" },
  { name: "Потолочный свет", type: "light", room: "Кухня", state: "off", attributes: { brightness: 100 }, icon: "💡" },
  { name: "Подсветка", type: "light", room: "Кухня", state: "off", attributes: { brightness: 50, color: "#00ffff" }, icon: "✨" },
  { name: "Кофемашина", type: "switch", room: "Кухня", state: "off", attributes: {}, icon: "☕" },
  { name: "Вытяжка", type: "switch", room: "Кухня", state: "off", attributes: {}, icon: "🌀" },
  { name: "Свет в ванной", type: "light", room: "Ванная", state: "off", attributes: { brightness: 80 }, icon: "💡" },
  { name: "Тёплый пол", type: "thermostat", room: "Ванная", state: "off", attributes: { temperature: 22, humidity: 45 }, icon: "🌡️" },
  { name: "Коридорный свет", type: "light", room: "Коридор", state: "off", attributes: { brightness: 70 }, icon: "💡" },
  { name: "Датчик движения", type: "sensor", room: "Коридор", state: "on", attributes: { motion: false, battery: 85 }, icon: "📡" },
  { name: "Замок входной", type: "lock", room: "Коридор", state: "on", attributes: { locked: true, battery: 72 }, icon: "🔒" },
  { name: "Рабочий свет", type: "light", room: "Офис", state: "off", attributes: { brightness: 100 }, icon: "💡" },
  { name: "Монитор", type: "switch", room: "Офис", state: "off", attributes: {}, icon: "🖥️" },
  { name: "Колонка", type: "speaker", room: "Офис", state: "off", attributes: { volume: 30 }, icon: "🔊" },
  { name: "Датчик температуры", type: "sensor", room: "Офис", state: "on", attributes: { temperature: 21.5, humidity: 40, battery: 92 }, icon: "🌡️" },
  { name: "Камера", type: "camera", room: "Гараж", state: "on", attributes: { recording: true }, icon: "📹" },
  { name: "Ворота", type: "switch", room: "Гараж", state: "off", attributes: {}, icon: "🚗" },
  { name: "Датчик протечки", type: "sensor", room: "Гараж", state: "on", attributes: { leak: false, battery: 60 }, icon: "💧" },
];

// ── localStorage helpers ──────────────────────────────────────

const DEVICES_KEY = "jarvis-smart-home-devices";
const HA_CONFIG_KEY = "jarvis-ha-config";
const MQTT_CONFIG_KEY = "jarvis-mqtt-config";

function isClient(): boolean {
  return typeof window !== "undefined";
}

// ── Device CRUD ───────────────────────────────────────────────

export function getDevices(): SmartDevice[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(DEVICES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SmartDevice[];
  } catch {
    return [];
  }
}

export function addDevice(device: Omit<SmartDevice, "id" | "lastUpdated">): SmartDevice {
  const devices = getDevices();
  const now = new Date().toISOString();
  const newDevice: SmartDevice = {
    ...device,
    id: `device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lastUpdated: now,
  };
  devices.push(newDevice);
  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  return newDevice;
}

export function updateDevice(id: string, patch: Partial<Omit<SmartDevice, "id">>): SmartDevice | null {
  const devices = getDevices();
  const idx = devices.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  devices[idx] = {
    ...devices[idx],
    ...patch,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  return devices[idx];
}

export function deleteDevice(id: string): boolean {
  const devices = getDevices();
  const filtered = devices.filter((d) => d.id !== id);
  if (filtered.length === devices.length) return false;
  localStorage.setItem(DEVICES_KEY, JSON.stringify(filtered));
  return true;
}

export function toggleDevice(id: string): SmartDevice | null {
  const devices = getDevices();
  const idx = devices.findIndex((d) => d.id === id);
  if (idx === -1) return null;
  const device = devices[idx];
  if (device.type === "sensor" || device.type === "camera") return device; // sensors/cameras can't toggle
  const newState: SmartDevice["state"] = device.state === "on" ? "off" : "on";
  device.state = newState;
  device.lastUpdated = new Date().toISOString();
  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
  return device;
}

// ── Device queries ────────────────────────────────────────────

export function getDevicesByRoom(room: string): SmartDevice[] {
  return getDevices().filter((d) => d.room === room);
}

export function getDevicesByType(type: SmartDevice["type"]): SmartDevice[] {
  return getDevices().filter((d) => d.type === type);
}

// ── Home Assistant API ────────────────────────────────────────

export async function fetchHAEntities(config: HomeAssistantConfig): Promise<unknown[]> {
  if (!config.enabled || !config.url || !config.token) {
    throw new Error("Home Assistant not configured");
  }
  const res = await fetch(`${config.url.replace(/\/+$/, "")}/api/states`, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`HA returned ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function callHAService(
  config: HomeAssistantConfig,
  entityId: string,
  domain: string,
  service: string,
  data: Record<string, unknown> = {},
): Promise<unknown> {
  if (!config.enabled || !config.url || !config.token) {
    throw new Error("Home Assistant not configured");
  }
  const res = await fetch(
    `${config.url.replace(/\/+$/, "")}/api/services/${domain}/${service}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entity_id: entityId, ...data }),
    },
  );
  if (!res.ok) {
    throw new Error(`HA service call failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Home Assistant Config ─────────────────────────────────────

export function getHAConfig(): HomeAssistantConfig {
  if (!isClient()) return { enabled: false, url: "", token: "", autoDiscover: false };
  try {
    const raw = localStorage.getItem(HA_CONFIG_KEY);
    if (!raw) return { enabled: false, url: "", token: "", autoDiscover: false };
    return JSON.parse(raw) as HomeAssistantConfig;
  } catch {
    return { enabled: false, url: "", token: "", autoDiscover: false };
  }
}

export function saveHAConfig(config: HomeAssistantConfig): void {
  if (!isClient()) return;
  localStorage.setItem(HA_CONFIG_KEY, JSON.stringify(config));
}

// ── MQTT Config ───────────────────────────────────────────────

export function getMQTTConfig(): MQTTConfig {
  if (!isClient()) return { enabled: false, broker: "" };
  try {
    const raw = localStorage.getItem(MQTT_CONFIG_KEY);
    if (!raw) return { enabled: false, broker: "" };
    return JSON.parse(raw) as MQTTConfig;
  } catch {
    return { enabled: false, broker: "" };
  }
}

export function saveMQTTConfig(config: MQTTConfig): void {
  if (!isClient()) return;
  localStorage.setItem(MQTT_CONFIG_KEY, JSON.stringify(config));
}

// ── MQTT stubs (future WebSocket MQTT) ───────────────────────

export async function connectMQTT(_config: MQTTConfig): Promise<{ connected: boolean; message: string }> {
  // Stub — will be implemented with WebSocket-based MQTT client
  return { connected: false, message: "MQTT over WebSocket — not yet implemented" };
}

export async function publishMQTT(
  _config: MQTTConfig,
  _topic: string,
  _message: string,
): Promise<{ success: boolean; message: string }> {
  // Stub
  return { success: false, message: "MQTT publish — not yet implemented" };
}

export async function subscribeMQTT(
  _config: MQTTConfig,
  _topic: string,
  _callback: (msg: string) => void,
): Promise<{ success: boolean; message: string }> {
  // Stub
  return { success: false, message: "MQTT subscribe — not yet implemented" };
}