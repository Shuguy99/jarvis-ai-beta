"use client";

// JARVIS Smart Home Panel — Home Assistant / MQTT dashboard widget

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  House,
  Plus,
  Power,
  Thermometer,
  Lightbulb,
  Lock,
  Speaker,
  Camera,
  Eye,
  Trash2,
  ChevronDown,
  Settings,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import {
  type SmartDevice,
  type HomeAssistantConfig,
  type MQTTConfig,
  ROOMS,
  DEVICE_TEMPLATES,
  getDevices,
  addDevice,
  updateDevice,
  deleteDevice,
  toggleDevice,
  getHAConfig,
  saveHAConfig,
  getMQTTConfig,
  saveMQTTConfig,
} from "@/lib/smart-home";

// ── Type icon helper ──────────────────────────────────────────

function typeIcon(type: SmartDevice["type"], className = "h-3.5 w-3.5") {
  switch (type) {
    case "light": return <Lightbulb className={className} />;
    case "switch": return <Power className={className} />;
    case "sensor": return <Eye className={className} />;
    case "thermostat": return <Thermometer className={className} />;
    case "camera": return <Camera className={className} />;
    case "lock": return <Lock className={className} />;
    case "speaker": return <Speaker className={className} />;
    default: return <Power className={className} />;
  }
}

// ── Add Device Form ───────────────────────────────────────────

function AddDeviceForm({ onAdd, onClose }: { onAdd: (d: Omit<SmartDevice, "id" | "lastUpdated">) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<SmartDevice["type"]>("light");
  const [room, setRoom] = useState<string>(ROOMS[0]);

  const defaultIcon: Record<SmartDevice["type"], string> = {
    light: "💡", switch: "🔌", sensor: "📡", thermostat: "🌡️",
    camera: "📹", lock: "🔒", speaker: "🔊", other: "⚙️",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      name: name.trim(),
      type,
      room,
      state: "off",
      attributes: type === "light" ? { brightness: 100 } : type === "thermostat" ? { temperature: 22 } : {},
      icon: defaultIcon[type],
    });
    playSound("activate");
    onClose();
  };

  return (
    <motion.form
      onSubmit={handleSubmit}
      className="space-y-2 border-t jarvis-border-cyan pt-3"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название устройства"
        className="w-full rounded-md border jarvis-border-cyan bg-background/60 px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
        autoFocus
      />
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as SmartDevice["type"])}
          className="flex-1 rounded-md border jarvis-border-cyan bg-background/60 px-2 py-1.5 font-mono text-[10px] text-foreground outline-none focus:border-primary"
        >
          <option value="light">💡 Свет</option>
          <option value="switch">🔌 Выключатель</option>
          <option value="sensor">📡 Датчик</option>
          <option value="thermostat">🌡️ Термостат</option>
          <option value="camera">📹 Камера</option>
          <option value="lock">🔒 Замок</option>
          <option value="speaker">🔊 Динамик</option>
          <option value="other">⚙️ Другое</option>
        </select>
        <select
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="flex-1 rounded-md border jarvis-border-cyan bg-background/60 px-2 py-1.5 font-mono text-[10px] text-foreground outline-none focus:border-primary"
        >
          {ROOMS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:bg-primary/20"
        >
          Добавить
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-muted-foreground/20 bg-transparent px-3 py-1.5 font-mono text-[10px] text-muted-foreground transition hover:text-foreground"
        >
          Отмена
        </button>
      </div>
    </motion.form>
  );
}

// ── HA Config Section ─────────────────────────────────────────

function HAConfigSection() {
  const [open, setOpen] = useState(false);
  const [haConfig, setHaConfig] = useState<HomeAssistantConfig>({ enabled: false, url: "", token: "", autoDiscover: false });
  const [mqttConfig, setMqttConfig] = useState<MQTTConfig>({ enabled: false, broker: "" });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setHaConfig(getHAConfig());
    setMqttConfig(getMQTTConfig());
  }, []);

  const saveHA = () => {
    saveHAConfig(haConfig);
    setStatus("HA config saved");
    playSound("data-received");
    setTimeout(() => setStatus(null), 2000);
  };

  const saveMQTT = () => {
    saveMQTTConfig(mqttConfig);
    setStatus("MQTT config saved");
    playSound("data-received");
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="border-t jarvis-border-cyan pt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-3.5 w-3.5 text-primary/60" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Интеграции</span>
        </div>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="mt-3 space-y-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            {/* Home Assistant */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <House className="h-3 w-3 text-primary/80" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/80">Home Assistant</span>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={haConfig.enabled}
                  onChange={(e) => setHaConfig((c) => ({ ...c, enabled: e.target.checked }))}
                  className="h-3 w-3 accent-primary"
                />
                <span className="font-mono text-[10px] text-muted-foreground">Включить</span>
              </label>
              <input
                value={haConfig.url}
                onChange={(e) => setHaConfig((c) => ({ ...c, url: e.target.value }))}
                placeholder="http://192.168.1.100:8123"
                className="w-full rounded-md border jarvis-border-cyan bg-background/60 px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
              />
              <input
                value={haConfig.token}
                onChange={(e) => setHaConfig((c) => ({ ...c, token: e.target.value }))}
                placeholder="Long-lived access token"
                type="password"
                className="w-full rounded-md border jarvis-border-cyan bg-background/60 px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
              />
              <button
                onClick={saveHA}
                className="w-full rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:bg-primary/20"
              >
                Сохранить HA
              </button>
            </div>

            {/* MQTT */}
            <div className="space-y-2 border-t jarvis-border-cyan pt-3">
              <div className="flex items-center gap-2">
                <Speaker className="h-3 w-3 text-primary/80" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-foreground/80">MQTT</span>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={mqttConfig.enabled}
                  onChange={(e) => setMqttConfig((c) => ({ ...c, enabled: e.target.checked }))}
                  className="h-3 w-3 accent-primary"
                />
                <span className="font-mono text-[10px] text-muted-foreground">Включить</span>
              </label>
              <input
                value={mqttConfig.broker}
                onChange={(e) => setMqttConfig((c) => ({ ...c, broker: e.target.value }))}
                placeholder="mqtt://192.168.1.100:1883"
                className="w-full rounded-md border jarvis-border-cyan bg-background/60 px-2.5 py-1.5 font-mono text-[10px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary"
              />
              <button
                onClick={saveMQTT}
                className="w-full rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary transition hover:bg-primary/20"
              >
                Сохранить MQTT
              </button>
            </div>

            {status && (
              <motion.p
                className="font-mono text-[10px] text-primary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ✓ {status}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function SmartHomePanel() {
  const [devices, setDevices] = useState<SmartDevice[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load devices from localStorage
  const refresh = useCallback(() => {
    setDevices(getDevices());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Add device from template or form
  const handleAddDevice = (device: Omit<SmartDevice, "id" | "lastUpdated">) => {
    addDevice(device);
    refresh();
  };

  // Toggle device on/off
  const handleToggle = (id: string) => {
    toggleDevice(id);
    playSound("click");
    refresh();
  };

  // Delete device
  const handleDelete = (id: string) => {
    deleteDevice(id);
    playSound("deactivate");
    refresh();
  };

  // Update brightness for light devices
  const handleBrightness = (id: string, brightness: number) => {
    updateDevice(id, { attributes: { ...devices.find((d) => d.id === id)?.attributes, brightness } });
    refresh();
  };

  // Filter devices by room
  const filteredDevices = activeRoom
    ? devices.filter((d) => d.room === activeRoom)
    : devices;

  // Count devices per room
  const roomCounts = ROOMS.map((r) => ({
    room: r,
    count: devices.filter((d) => d.room === r).length,
  }));

  return (
    <motion.div
      className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-4 backdrop-blur-sm"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
      <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-30" />

      <div className="relative flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <House className="h-4 w-4 text-primary anim-data-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-primary jarvis-glow">
              Smart Home
            </span>
            <span className="font-mono text-[9px] text-muted-foreground">
              {devices.length} devices
            </span>
          </div>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-md border jarvis-border-cyan p-1.5 text-muted-foreground transition hover:border-primary/40 hover:text-primary"
            title="Добавить устройство"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Room tabs */}
        <div className="flex gap-1 overflow-x-auto jarvis-scroll pb-1">
          <button
            onClick={() => setActiveRoom(null)}
            className={`flex-shrink-0 rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition ${
              activeRoom === null
                ? "border border-primary/40 bg-primary/15 text-primary"
                : "border border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Все
          </button>
          {roomCounts.map((r) => (
            <button
              key={r.room}
              onClick={() => setActiveRoom(r.room === activeRoom ? null : r.room)}
              className={`flex-shrink-0 rounded-md px-2 py-1 font-mono text-[9px] uppercase tracking-wider transition ${
                activeRoom === r.room
                  ? "border border-primary/40 bg-primary/15 text-primary"
                  : "border border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.room}
              {r.count > 0 && (
                <span className="ml-1 text-[8px] opacity-60">{r.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Add Device Form */}
        <AnimatePresence>
          {showAddForm && (
            <AddDeviceForm
              onAdd={handleAddDevice}
              onClose={() => setShowAddForm(false)}
            />
          )}
        </AnimatePresence>

        {/* Quick Templates */}
        {showAddForm && devices.length === 0 && (
          <div className="space-y-1 border-t jarvis-border-cyan pt-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              Быстрые шаблоны
            </p>
            <div className="flex flex-wrap gap-1">
              {DEVICE_TEMPLATES.slice(0, 6).map((tmpl) => (
                <button
                  key={tmpl.name}
                  onClick={() => handleAddDevice(tmpl)}
                  className="rounded-md border jarvis-border-cyan bg-primary/5 px-2 py-1 font-mono text-[9px] text-muted-foreground transition hover:bg-primary/10 hover:text-foreground"
                >
                  {tmpl.icon} {tmpl.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                DEVICE_TEMPLATES.forEach((tmpl) => addDevice(tmpl));
                refresh();
                playSound("activate");
              }}
              className="w-full rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 font-mono text-[10px] text-primary/80 transition hover:bg-primary/10"
            >
              + Загрузить все шаблоны
            </button>
          </div>
        )}

        {/* Device Grid */}
        <div className="space-y-1.5 jarvis-scroll max-h-[400px] overflow-y-auto">
          {filteredDevices.length === 0 && !showAddForm && (
            <div className="flex flex-col items-center gap-2 py-6">
              <span className="text-2xl opacity-40">🏠</span>
              <p className="font-mono text-[10px] text-muted-foreground">
                {devices.length === 0 ? "Нет устройств. Нажмите + для добавления." : "Нет устройств в этой комнате."}
              </p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {filteredDevices.map((device) => (
              <motion.div
                key={device.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="group rounded-lg border jarvis-border-cyan bg-card/30 p-2 transition hover:bg-card/60"
              >
                <div className="flex items-center gap-2">
                  {/* Icon */}
                  <span className="flex-shrink-0 text-base">{device.icon}</span>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-mono text-[10px] font-semibold text-foreground">
                        {device.name}
                      </span>
                      <span className="flex-shrink-0 font-mono text-[8px] text-muted-foreground/50">
                        {device.room}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {typeIcon(device.type, "h-2.5 w-2.5 text-muted-foreground/50")}
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {device.type}
                      </span>
                      {/* Key attribute */}
                      {device.type === "light" && typeof device.attributes.brightness === "number" && device.state === "on" && (
                        <span className="font-mono text-[9px] text-primary/60">
                          {device.attributes.brightness}%
                        </span>
                      )}
                      {device.type === "thermostat" && typeof device.attributes.temperature === "number" && (
                        <span className="font-mono text-[9px] text-primary/60">
                          {device.attributes.temperature}°C
                        </span>
                      )}
                      {device.type === "sensor" && typeof device.attributes.temperature === "number" && (
                        <span className="font-mono text-[9px] text-primary/60">
                          {device.attributes.temperature}°C
                          {typeof device.attributes.humidity === "number" && ` · ${device.attributes.humidity}%`}
                        </span>
                      )}
                      {device.type === "lock" && (
                        <span className={`font-mono text-[9px] ${device.attributes.locked ? "text-primary/60" : "text-destructive/60"}`}>
                          {device.attributes.locked ? "Locked" : "Unlocked"}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Toggle / Controls */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {device.type !== "sensor" && device.type !== "camera" && (
                      <button
                        onClick={() => handleToggle(device.id)}
                        className={`relative h-5 w-9 rounded-full border transition-colors ${
                          device.state === "on"
                            ? "border-primary bg-primary/30"
                            : "border-muted-foreground/30 bg-background"
                        }`}
                      >
                        <motion.div
                          className="absolute top-0.5 h-3.5 w-3.5 rounded-full"
                          animate={{
                            left: device.state === "on" ? "16px" : "2px",
                            backgroundColor: device.state === "on" ? "var(--primary)" : "var(--muted-foreground)",
                          }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    )}

                    {/* Expand / Delete */}
                    {(device.type === "light" || device.type === "speaker") && (
                      <button
                        onClick={() => setExpandedId(expandedId === device.id ? null : device.id)}
                        className="rounded p-0.5 text-muted-foreground/50 transition hover:text-foreground"
                      >
                        <ChevronDown className={`h-3 w-3 transition-transform ${expandedId === device.id ? "rotate-180" : ""}`} />
                      </button>
                    )}

                    <button
                      onClick={() => handleDelete(device.id)}
                      className="rounded p-0.5 text-muted-foreground/30 transition hover:text-destructive opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Expanded controls */}
                <AnimatePresence>
                  {expandedId === device.id && (
                    <motion.div
                      className="mt-2 border-t jarvis-border-cyan pt-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {device.type === "light" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] text-muted-foreground">Brightness</span>
                            <span className="font-mono text-[9px] text-primary">
                              {typeof device.attributes.brightness === "number" ? device.attributes.brightness : 100}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={100}
                            value={typeof device.attributes.brightness === "number" ? device.attributes.brightness : 100}
                            onChange={(e) => handleBrightness(device.id, Number(e.target.value))}
                            className="h-1 w-full cursor-pointer accent-primary"
                          />
                        </div>
                      )}
                      {device.type === "speaker" && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] text-muted-foreground">Volume</span>
                            <span className="font-mono text-[9px] text-primary">
                              {typeof device.attributes.volume === "number" ? device.attributes.volume : 50}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={typeof device.attributes.volume === "number" ? device.attributes.volume : 50}
                            onChange={(e) => {
                              const vol = Number(e.target.value);
                              updateDevice(device.id, { attributes: { ...device.attributes, volume: vol } });
                              refresh();
                            }}
                            className="h-1 w-full cursor-pointer accent-primary"
                          />
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Integrations config */}
        <HAConfigSection />
      </div>
    </motion.div>
  );
}