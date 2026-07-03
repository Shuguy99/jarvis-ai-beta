"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Plus,
  AlertTriangle,
  Info,
  X,
  Shield,
  ChevronDown,
} from "lucide-react";
import { playSound } from "@/lib/sounds";
import {
  type Notification,
  type NotificationRule,
  subscribe,
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  clearAll,
  getRules,
  addRule,
  toggleRule,
  removeRule,
} from "@/lib/notification-center";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Props ───────────────────────────────────────────────────────────

interface NotificationCenterProps {
  open: boolean;
  onClose: () => void;
}

// ── Helpers ─────────────────────────────────────────────────────────

const TYPE_COLORS: Record<
  Notification["type"],
  { border: string; bg: string; icon: typeof Info; iconColor: string }
> = {
  info: {
    border: "border-l-primary",
    bg: "bg-primary/5",
    icon: Info,
    iconColor: "text-primary",
  },
  success: {
    border: "border-l-emerald-400",
    bg: "bg-emerald-400/5",
    icon: Check,
    iconColor: "text-emerald-400",
  },
  warning: {
    border: "border-l-amber-400",
    bg: "bg-amber-400/5",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
  },
  error: {
    border: "border-l-rose-400",
    bg: "bg-rose-400/5",
    icon: X,
    iconColor: "text-rose-400",
  },
  critical: {
    border: "border-l-rose-500",
    bg: "bg-rose-500/10",
    icon: AlertTriangle,
    iconColor: "text-rose-400",
  },
};

const TYPE_LABELS: Record<NotificationRule["type"], string> = {
  info: "Инфо",
  warning: "Внимание",
  critical: "Критично",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "только что";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} мин назад`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ч назад`;
  const days = Math.floor(hr / 24);
  return `${days} дн назад`;
}

function groupByTime(notifs: Notification[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);

  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const earlier: Notification[] = [];

  for (const n of notifs) {
    const d = new Date(n.timestamp);
    if (d >= todayStart) today.push(n);
    else if (d >= yesterdayStart) yesterday.push(n);
    else earlier.push(n);
  }

  return [
    { label: "Сегодня", items: today },
    { label: "Вчера", items: yesterday },
    { label: "Ранее", items: earlier },
  ].filter((g) => g.items.length > 0);
}

// ── Rule Editor ─────────────────────────────────────────────────────

function RulesSection() {
  const [rules, setRules] = useState<NotificationRule[]>(() => getRules());
  const [showForm, setShowForm] = useState(false);
  const [formCondition, setFormCondition] = useState("");
  const [formType, setFormType] = useState<NotificationRule["type"]>("warning");
  const [formMessage, setFormMessage] = useState("");

  const refresh = useCallback(() => setRules(getRules()), []);

  const handleToggle = (id: string, enabled: boolean) => {
    playSound("click");
    toggleRule(id, enabled);
    refresh();
  };

  const handleRemove = (id: string) => {
    playSound("click");
    removeRule(id);
    refresh();
  };

  const handleAdd = () => {
    if (!formCondition.trim() || !formMessage.trim()) return;
    playSound("success");
    addRule({
      name: formMessage.trim(),
      enabled: true,
      condition: formCondition.trim(),
      type: formType,
      message: formMessage.trim(),
      cooldown: 60,
    });
    setFormCondition("");
    setFormMessage("");
    setFormType("warning");
    setShowForm(false);
    refresh();
  };

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground/70 transition-colors hover:text-foreground">
        <Shield className="h-3.5 w-3.5" />
        <span className="flex-1 text-left">Правила уведомлений</span>
        <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 pb-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/10 px-2.5 py-2"
            >
              <Switch
                checked={rule.enabled}
                onCheckedChange={(v) => handleToggle(rule.id, v)}
                className="data-[state=checked]:bg-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[10px] font-bold text-foreground/90">
                  {rule.name}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground/60">
                  {rule.condition} · {rule.cooldown}с
                </div>
              </div>
              <Badge
                variant="outline"
                className="h-4 border-border/40 px-1.5 font-mono text-[8px]"
              >
                {TYPE_LABELS[rule.type]}
              </Badge>
              <button
                onClick={() => handleRemove(rule.id)}
                className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-rose-400"
                aria-label="Удалить правило"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Add rule form */}
          {showForm ? (
            <div className="space-y-2 rounded-md border border-primary/20 bg-primary/5 p-2.5">
              <Input
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value)}
                placeholder="cpu > 90"
                className="h-7 rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[10px] placeholder:text-muted-foreground/40"
              />
              <div className="flex gap-2">
                <Select
                  value={formType}
                  onValueChange={(v) =>
                    setFormType(v as NotificationRule["type"])
                  }
                >
                  <SelectTrigger className="h-7 w-[110px] rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Инфо</SelectItem>
                    <SelectItem value="warning">Внимание</SelectItem>
                    <SelectItem value="critical">Критично</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Сообщение"
                  className="h-7 flex-1 rounded-md border jarvis-border-cyan bg-muted/20 font-mono text-[10px] placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 flex-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setShowForm(false)}
                >
                  Отмена
                </Button>
                <Button
                  size="sm"
                  className="h-6 flex-1 bg-primary/20 font-mono text-[10px] text-primary hover:bg-primary/30"
                  onClick={handleAdd}
                >
                  Добавить
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                playSound("click");
                setShowForm(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border/40 py-1.5 font-mono text-[10px] text-muted-foreground/60 transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Добавить правило
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Single Notification Row ─────────────────────────────────────────

function NotificationRow({
  notif,
  onClick,
}: {
  notif: Notification;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const colors = TYPE_COLORS[notif.type];
  const Icon = colors.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40, height: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      onClick={onClick}
      className={`group cursor-pointer rounded-md border-l-2 ${colors.border} ${
        notif.read ? "bg-muted/5" : `${colors.bg} bg-card/40`
      } px-3 py-2 transition-colors hover:bg-card/60`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${colors.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!notif.read && (
              <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
            )}
            <span className="truncate font-mono text-[11px] font-bold text-foreground/90">
              {notif.title}
            </span>
            <Badge
              variant="outline"
              className="h-3.5 flex-shrink-0 border-border/30 px-1 font-mono text-[7px] text-muted-foreground/50"
            >
              {notif.source}
            </Badge>
          </div>
          <p
            className={`mt-0.5 font-mono text-[10px] leading-relaxed text-muted-foreground/70 ${
              expanded ? "" : "line-clamp-2"
            }`}
            onClick={(e) => {
              if (notif.message.length > 60) {
                e.stopPropagation();
                setExpanded(!expanded);
              }
            }}
          >
            {notif.message}
          </p>
          <div className="mt-1 flex items-center gap-2 font-mono text-[8px] text-muted-foreground/40">
            <span>{relativeTime(notif.timestamp)}</span>
            {notif.action && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  notif.action?.onClick();
                }}
                className="rounded px-1.5 py-0.5 text-[8px] text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {notif.action.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
      <BellOff className="mb-3 h-10 w-10" />
      <div className="font-mono text-sm">Нет уведомлений</div>
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────

export function NotificationCenter({ open, onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>(() => getNotifications());

  // Subscribe to changes
  useEffect(() => {
    if (!open) return;
    const unsub = subscribe((list) => {
      setNotifications([...list]);
    });
    return unsub;
  }, [open]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const groups = useMemo(() => groupByTime(notifications), [notifications]);

  const handleMarkAllRead = () => {
    playSound("click");
    markAllRead();
    setNotifications(getNotifications());
  };

  const handleClearAll = () => {
    playSound("click");
    clearAll();
  };

  const handleMarkRead = (id: string) => {
    playSound("click");
    markRead(id);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="notif-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            key="notif-panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md border-l jarvis-border-cyan jarvis-glass-strong bg-background/90 shadow-2xl shadow-primary/5"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4">
              <Bell className="h-4 w-4 text-primary" />
              <div className="flex-1">
                <h2 className="font-mono text-sm font-bold tracking-wide text-foreground">
                  Notification Center
                </h2>
              </div>
              {unreadCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/20 px-1.5 font-mono text-[10px] font-bold text-primary">
                  {unreadCount}
                </span>
              )}
              <button
                onClick={handleMarkAllRead}
                className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-primary/10 hover:text-primary"
                title="Прочитать все"
                aria-label="Пометить все прочитанными"
              >
                <CheckCheck className="h-4 w-4" />
              </button>
              <button
                onClick={handleClearAll}
                className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                title="Очистить все"
                aria-label="Очистить все уведомления"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  playSound("click");
                  onClose();
                }}
                className="rounded p-1.5 text-muted-foreground/50 transition-colors hover:bg-primary/10 hover:text-primary"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex h-[calc(100%-65px)] flex-col overflow-hidden">
              {/* Rules section */}
              <div className="border-b border-border/30 px-5">
                <RulesSection />
              </div>

              {/* Notifications list */}
              <div className="jarvis-scroll flex-1 overflow-y-auto">
                {notifications.length === 0 ? (
                  <EmptyState />
                ) : (
                  <div className="space-y-3 p-4">
                    {groups.map((group) => (
                      <div key={group.label}>
                        <div className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                          {group.label}
                        </div>
                        <div className="space-y-1.5">
                          <AnimatePresence>
                            {group.items.map((n) => (
                              <NotificationRow
                                key={n.id}
                                notif={n}
                                onClick={() => handleMarkRead(n.id)}
                              />
                            ))}
                          </AnimatePresence>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}