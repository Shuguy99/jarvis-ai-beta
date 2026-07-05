import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  MessageCircle,
  Clock,
  FileText,
  BarChart3,
  Hash,
  X,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

interface AnalyticsData {
  totalConversations: number;
  totalMessages: number;
  messagesToday: number;
  messagesThisWeek: number;
  activeConversations: number;
  notesCount: number;
  avgMessagesPerConversation: number;
}

interface AnalyticsWidgetProps {
  open: boolean;
  onClose: () => void;
}

const STATS = [
  { key: "totalMessages" as const, label: "Всего сообщений", icon: MessageSquare, color: "text-primary" },
  { key: "messagesToday" as const, label: "Сообщений сегодня", icon: MessageCircle, color: "text-emerald-400" },
  { key: "messagesThisWeek" as const, label: "За неделю", icon: Clock, color: "text-amber-400" },
  { key: "totalConversations" as const, label: "Всего диалогов", icon: BarChart3, color: "text-violet-400" },
  { key: "activeConversations" as const, label: "Активных за неделю", icon: Hash, color: "text-rose-400" },
  { key: "notesCount" as const, label: "Заметок", icon: FileText, color: "text-sky-400" },
] as const;

export function AnalyticsWidget({ open, onClose }: AnalyticsWidgetProps) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/jarvis/analytics", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60_000);
    return () => clearInterval(interval);
  }, [open, fetchAnalytics]);

  if (!open) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="relative w-full max-w-lg overflow-hidden rounded-xl border-2 jarvis-border-cyan jarvis-box-glow-strong bg-card/95 shadow-2xl backdrop-blur-xl p-5"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary jarvis-glow" />
            <h2 className="font-mono text-xs uppercase tracking-widest text-primary">
              Статистика использования
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoading(true); fetchAnalytics(); }}
              className="rounded-md p-1.5 border border-primary/20 bg-primary/5 hover:bg-primary/15 transition-colors"
              title="Обновить"
            >
              <RefreshCw className={`w-3 h-3 text-primary/70 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 border border-primary/20 bg-primary/5 hover:bg-primary/15 transition-colors"
            >
              <X className="w-3 h-3 text-primary/70" />
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        {loading && !data ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg border border-[#00d4ff]/20 bg-card/10 animate-pulse" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.key}
                    className="border border-[#00d4ff]/20 rounded-lg p-3 bg-card/10 hover:bg-card/20 transition-colors"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon className={`w-3.5 h-3.5 ${stat.color}`} />
                      <span className="text-[10px] font-mono uppercase text-primary/50 tracking-wider">
                        {stat.label}
                      </span>
                    </div>
                    <p className="text-2xl font-mono font-bold text-foreground tabular-nums">
                      {data[stat.key].toLocaleString()}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Average */}
            <div className="border border-[#00d4ff]/10 rounded-lg p-3 bg-card/5">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-3 h-3 text-primary/40" />
                <span className="text-[10px] font-mono uppercase text-primary/40 tracking-wider">
                  Среднее сообщений на диалог
                </span>
              </div>
              <p className="text-lg font-mono font-bold text-foreground tabular-nums">
                {data.avgMessagesPerConversation}
              </p>
            </div>
          </>
        ) : (
          <div className="py-8 text-center text-primary/50 font-mono text-xs">
            Не удалось загрузить статистику
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}