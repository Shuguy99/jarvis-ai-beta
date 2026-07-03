"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, CheckCircle, AlertTriangle, XCircle, X } from "lucide-react";
import { playSound } from "@/lib/sounds";
import { addActivityEvent } from "@/components/jarvis/activity-feed";
import { addNotification as addToCenter } from "@/lib/notification-center";

// ── Types ─────────────────────────────────────────────────────
type ToastType = "info" | "success" | "warning" | "error";

interface Toast {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  duration: number;
  timestamp: number;
}

// ── Module-level notification bus ─────────────────────────────
const toastListeners = new Set<(toast: Toast) => void>();

export function showNotification(
  opts: Omit<Toast, "id" | "timestamp" | "duration">
) {
  const full: Toast = {
    ...opts,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    duration: 4000,
  };
  toastListeners.forEach((fn) => fn(full));
  // Also push to Activity Feed
  addActivityEvent({
    message: opts.title + (opts.message ? `: ${opts.message}` : ""),
    severity: opts.type,
    category: "system",
  });
  // Push to Notification Center history
  addToCenter({
    title: opts.title,
    message: opts.message ?? "",
    type: opts.type === "error" ? "error" : opts.type,
    source: "system",
  });
}

export function useNotificationListener(fn: (toast: Toast) => void) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => {
    const listener = (t: Toast) => fnRef.current(t);
    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);
}

// ── Constants ─────────────────────────────────────────────────
const MAX_VISIBLE = 5;

const TYPE_CONFIG: Record<
  ToastType,
  {
    icon: React.ComponentType<{ className?: string }>;
    barColor: string;
    iconColor: string;
  }
> = {
  info: {
    icon: Info,
    barColor: "bg-primary",
    iconColor: "text-primary",
  },
  success: {
    icon: CheckCircle,
    barColor: "bg-emerald-400",
    iconColor: "text-emerald-400",
  },
  warning: {
    icon: AlertTriangle,
    barColor: "bg-amber-400",
    iconColor: "text-amber-400",
  },
  error: {
    icon: XCircle,
    barColor: "bg-rose-400",
    iconColor: "text-rose-400",
  },
};

// ── Single Toast Card ─────────────────────────────────────────
function ToastCard({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Date.now() for animation timing; ref ensures it's set once
  // eslint-disable-next-line react-hooks/purity
  const startTimeRef = useRef<number>(Date.now());
  const config = TYPE_CONFIG[t.type];
  const Icon = config.icon;

  // Progress bar animation
  useEffect(() => {
    startTimeRef.current = Date.now();
    const step = 50; // ms per tick
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 100 - (elapsed / t.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        onDismiss(t.id);
      }
    }, step);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [t.id, t.duration, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative w-72 overflow-hidden rounded-lg border border-primary/20 backdrop-blur-md bg-card/80"
    >
      {/* Left color bar */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${config.barColor}`}
      />

      <div className="flex items-start gap-3 p-3 pl-4">
        <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${config.iconColor}`} />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-bold text-foreground">
            {t.title}
          </div>
          {t.message && (
            <div className="mt-0.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
              {t.message}
            </div>
          )}
        </div>
        <button
          onClick={() => onDismiss(t.id)}
          className="flex-shrink-0 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
          aria-label="Закрыть уведомление"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-primary/10">
        <motion.div
          className={`h-full ${config.barColor}`}
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.05, ease: "linear" }}
        />
      </div>
    </motion.div>
  );
}

// ── Container Component ───────────────────────────────────────
export function NotificationToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen to the notification bus
  useNotificationListener(
    useCallback(
      (toast: Toast) => {
        // Play sound only for warning and error to avoid noise fatigue
        if (toast.type === "warning") {
          playSound("warning", 0.3);
        } else if (toast.type === "error") {
          playSound("error", 0.3);
        }

        setToasts((prev) => {
          const next = [...prev, toast];
          // Max 5 visible — dismiss oldest if exceeded
          return next.length > MAX_VISIBLE ? next.slice(-MAX_VISIBLE) : next;
        });
      },
      []
    )
  );

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}