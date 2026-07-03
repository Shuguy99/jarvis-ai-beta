// ── Notification Center — Module-level singleton ─────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "critical";
  timestamp: string;
  read: boolean;
  source: string;
  persistent?: boolean;
  action?: { label: string; onClick: () => void };
}

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: string;
  type: "info" | "warning" | "critical";
  message: string;
  cooldown: number; // seconds
}

const MAX_NOTIFICATIONS = 100;
const STORAGE_KEY = "jarvis-notif-rules";

const DEFAULT_RULES: Omit<NotificationRule, "id">[] = [
  {
    name: "Высокая нагрузка CPU",
    enabled: true,
    condition: "cpu > 90",
    type: "warning",
    message: "Высокая нагрузка CPU",
    cooldown: 60,
  },
  {
    name: "Память почти заполнена",
    enabled: true,
    condition: "ram > 85",
    type: "warning",
    message: "Память почти заполнена",
    cooldown: 60,
  },
  {
    name: "Место на диске критически мало",
    enabled: true,
    condition: "disk > 95",
    type: "critical",
    message: "Место на диске критически мало",
    cooldown: 120,
  },
];

// ── In-memory stores ─────────────────────────────────────────────────────

const notifications: Notification[] = [];
const subscribers = new Set<(_notifications: Notification[]) => void>();
const ruleCooldowns = new Map<string, number>(); // ruleId → lastTriggered timestamp

function loadRules(): NotificationRule[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as NotificationRule[];
      // Merge with defaults: add any missing defaults
      for (const def of DEFAULT_RULES) {
        if (!parsed.find((r) => r.name === def.name)) {
          parsed.push({ ...def, id: crypto.randomUUID() });
        }
      }
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_RULES.map((r) => ({ ...r, id: crypto.randomUUID() }));
}

function saveRules(rules: NotificationRule[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {
    /* ignore */
  }
}

let rules: NotificationRule[] = [];

// Lazy-init rules on first call that touches them
function ensureRules() {
  if (rules.length === 0 && typeof window !== "undefined") {
    rules = loadRules();
  }
}

function emit() {
  const snapshot = [...notifications];
  subscribers.forEach((fn) => fn(snapshot));
}

// ── Public API ───────────────────────────────────────────────────────────

export function addNotification(
  notif: Omit<Notification, "id" | "timestamp" | "read">
): string {
  const id = crypto.randomUUID();
  const entry: Notification = {
    ...notif,
    id,
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifications.unshift(entry);
  // FIFO: trim oldest
  while (notifications.length > MAX_NOTIFICATIONS) {
    notifications.pop();
  }
  emit();
  return id;
}

export function getNotifications(limit?: number): Notification[] {
  if (limit !== undefined) return notifications.slice(0, limit);
  return [...notifications];
}

export function getUnreadCount(): number {
  return notifications.filter((n) => !n.read).length;
}

export function markRead(id: string): void {
  const n = notifications.find((n) => n.id === id);
  if (n && !n.read) {
    n.read = true;
    emit();
  }
}

export function markAllRead(): void {
  let changed = false;
  for (const n of notifications) {
    if (!n.read) {
      n.read = true;
      changed = true;
    }
  }
  if (changed) emit();
}

export function clearAll(): void {
  notifications.length = 0;
  emit();
}

// ── Rules API ────────────────────────────────────────────────────────────

export function getRules(): NotificationRule[] {
  ensureRules();
  return [...rules];
}

export function addRule(rule: Omit<NotificationRule, "id">): void {
  ensureRules();
  rules.push({ ...rule, id: crypto.randomUUID() });
  saveRules(rules);
}

export function toggleRule(id: string, enabled: boolean): void {
  ensureRules();
  const r = rules.find((r) => r.id === id);
  if (r) {
    r.enabled = enabled;
    saveRules(rules);
  }
}

export function removeRule(id: string): void {
  ensureRules();
  rules = rules.filter((r) => r.id !== id);
  ruleCooldowns.delete(id);
  saveRules(rules);
}

// ── Rule Evaluation ──────────────────────────────────────────────────────

export function evaluateRules(metrics: {
  cpuUsage?: number;
  memUsagePercent?: number;
  diskUsagePercent?: number;
}): Notification[] {
  ensureRules();
  const now = Date.now();
  const triggered: Notification[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const cond = rule.condition.trim().toLowerCase();
    let match = false;

    if (cond.startsWith("cpu") && metrics.cpuUsage !== undefined) {
      const threshold = parseFloat(cond.replace(/[^0-9.]/g, ""));
      if (cond.includes(">") && metrics.cpuUsage > threshold) match = true;
      if (cond.includes("<") && metrics.cpuUsage < threshold) match = true;
    }

    if (cond.startsWith("ram") && metrics.memUsagePercent !== undefined) {
      const threshold = parseFloat(cond.replace(/[^0-9.]/g, ""));
      if (cond.includes(">") && metrics.memUsagePercent > threshold) match = true;
      if (cond.includes("<") && metrics.memUsagePercent < threshold) match = true;
    }

    if (cond.startsWith("disk") && metrics.diskUsagePercent !== undefined) {
      const threshold = parseFloat(cond.replace(/[^0-9.]/g, ""));
      if (cond.includes(">") && metrics.diskUsagePercent > threshold) {
        match = true;
      }
      if (cond.includes("<") && metrics.diskUsagePercent < threshold) {
        match = true;
      }
    }

    if (match) {
      // Check cooldown
      const lastTriggered = ruleCooldowns.get(rule.id) ?? 0;
      if (now - lastTriggered < rule.cooldown * 1000) continue;

      ruleCooldowns.set(rule.id, now);
      const id = addNotification({
        title: rule.name,
        message: rule.message,
        type: rule.type,
        source: "system",
        persistent: rule.type === "critical",
      });
      const notif = notifications.find((n) => n.id === id);
      if (notif) triggered.push(notif);
    }
  }

  return triggered;
}

// ── Pub/Sub ──────────────────────────────────────────────────────────────

export function subscribe(
  callback: (_notifications: Notification[]) => void
): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}