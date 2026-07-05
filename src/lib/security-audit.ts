/**
 * JARVIS Security Audit Log
 * Records security-relevant events for review
 */

export type AuditEventType =
  | "auth_attempt"        // Login/auth attempt
  | "settings_change"     // Settings modified
  | "api_key_change"      // API key added/removed/changed
  | "data_export"         // Data exported (PDF, HTML, etc.)
  | "data_delete"         // Data deleted
  | "provider_change"     // AI provider switched
  | "incognito_toggle"    // Incognito mode toggled
  | "dnd_toggle"          // DND mode toggled
  | "profile_switch"      // User profile switched
  | "tool_create"         // Custom tool created
  | "tool_modify"         // Custom tool modified
  | "tool_delete"         // Custom tool deleted
  | "plugin_load"         // Plugin loaded
  | "error"               // Error occurred
  | "security_alert";     // Security concern detected

export interface AuditEntry {
  id: string;
  timestamp: string;
  type: AuditEventType;
  message: string;
  details?: string;
  severity: "info" | "warning" | "critical";
}

const STORAGE_KEY = "jarvis-audit-log";
const MAX_ENTRIES = 500;

const uid = () => Math.random().toString(36).slice(2, 10);

function getLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLog(log: AuditEntry[]) {
  try {
    // Keep only last MAX_ENTRIES
    const trimmed = log.length > MAX_ENTRIES ? log.slice(-MAX_ENTRIES) : log;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch { /* storage full, ignore */ }
}

/**
 * Log a security audit event
 */
export function auditLog(
  type: AuditEventType,
  message: string,
  details?: string,
  severity: AuditEntry["severity"] = "info"
): void {
  const entry: AuditEntry = {
    id: uid(),
    timestamp: new Date().toISOString(),
    type,
    message,
    details,
    severity,
  };
  const log = getLog();
  log.push(entry);
  saveLog(log);
}

/**
 * Get all audit log entries
 */
export function getAuditLog(limit = 100, offset = 0): AuditEntry[] {
  const log = getLog();
  return log.slice(offset, offset + limit).reverse(); // newest first
}

/**
 * Get audit log filtered by type
 */
export function getAuditLogByType(type: AuditEventType): AuditEntry[] {
  return getLog().filter(e => e.type === type).reverse();
}

/**
 * Get audit stats
 */
export function getAuditStats(): {
  total: number;
  today: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  lastEvent: AuditEntry | null;
} {
  const log = getLog();
  const today = new Date().toDateString();

  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let todayCount = 0;

  for (const entry of log) {
    byType[entry.type] = (byType[entry.type] || 0) + 1;
    bySeverity[entry.severity] = (bySeverity[entry.severity] || 0) + 1;
    if (new Date(entry.timestamp).toDateString() === today) todayCount++;
  }

  return {
    total: log.length,
    today: todayCount,
    byType,
    bySeverity,
    lastEvent: log.length > 0 ? log[log.length - 1] : null,
  };
}

/**
 * Clear audit log
 */
export function clearAuditLog(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

/**
 * Export audit log as CSV
 */
export function exportAuditLogCSV(): string {
  const log = getLog();
  const header = "ID,Timestamp,Type,Severity,Message,Details\n";
  const rows = log.map(e =>
    `${e.id},${e.timestamp},${e.type},${e.severity},"${e.message.replace(/"/g, '""')}","${(e.details || "").replace(/"/g, '""')}"`
  ).join("\n");
  return header + rows;
}

// Severity config for UI
export const SEVERITY_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  info: { color: "text-primary", label: "Info", icon: "i" },
  warning: { color: "text-yellow-400", label: "Warning", icon: "!" },
  critical: { color: "text-destructive", label: "Critical", icon: "!!" },
};

// Event type labels
export const EVENT_LABELS: Record<AuditEventType, string> = {
  auth_attempt: "Попытка авторизации",
  settings_change: "Изменение настроек",
  api_key_change: "Изменение API ключа",
  data_export: "Экспорт данных",
  data_delete: "Удаление данных",
  provider_change: "Смена провайдера",
  incognito_toggle: "Режим инкогнито",
  dnd_toggle: "Режим DND",
  profile_switch: "Смена профиля",
  tool_create: "Создание тулa",
  tool_modify: "Изменение тулa",
  tool_delete: "Удаление тулa",
  plugin_load: "Загрузка плагина",
  error: "Ошибка",
  security_alert: "Тревога безопасности",
};