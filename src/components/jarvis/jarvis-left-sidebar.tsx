

// Левая боковая панель — виджеты и список диалогов
// Извлечён из page.tsx (бывшие строки 604-719)
// Токены ~4k, время рендера ~5ms

import { useCallback } from "react";
import { motion } from "framer-motion";
import { useUIStore } from "@/lib/ui-store";
import type { UseJarvisReturn } from "@/hooks/use-jarvis";
import { DndWidgetList } from "@/components/jarvis/dnd-widget-list";
import { WidgetErrorBoundary } from "@/components/jarvis/widget-error-boundary";
import { ConversationList } from "@/components/jarvis/conversation-list";
import {
  MemoizedQuickLaunchWidget, MemoizedSystemMonitor,
  MemoizedSessionStatsWidget, MemoizedShortcutsWidget,
  MemoizedFileExplorerWidget, MemoizedCalendarWidget,
  MemoizedActivityFeed, MemoizedSystemAlertsWidget,
  MemoizedHoloGlobe, MemoizedGitHubWidget,
} from "@/components/jarvis/memoized-widgets";
import { LazyMetricsHistoryChart, JarvisSuspense } from "@/lib/lazy-components";

interface JarvisLeftSidebarProps {
  jarvis: UseJarvisReturn;
}

export function JarvisLeftSidebar({ jarvis }: JarvisLeftSidebarProps) {
  const dndMode = useUIStore((s) => s.dndMode);
  const leftWidgetIds = useUIStore((s) => s.leftWidgetIds);
  const setLeftWidgetIds = useUIStore((s) => s.setLeftWidgetIds);

  // DnD widget renderer — используется только в режиме перетаскивания
  const renderLeftWidget = useCallback((widgetId: string) => {
    const base = "transition-all duration-300";
    switch (widgetId) {
      case "quick-launch": return <div className={base}><WidgetErrorBoundary name="Quick Launch"><MemoizedQuickLaunchWidget /></WidgetErrorBoundary></div>;
      case "system-monitor": return <div className={`jarvis-holo-glitch jarvis-crt-noise flex-shrink-0 ${base}`}><WidgetErrorBoundary name="System Diagnostics"><MemoizedSystemMonitor /></WidgetErrorBoundary></div>;
      case "metrics-history": return <div className={base}><JarvisSuspense><LazyMetricsHistoryChart /></JarvisSuspense></div>;
      case "activity-feed": return <div className={base}><WidgetErrorBoundary name="Activity Feed"><MemoizedActivityFeed /></WidgetErrorBoundary></div>;
      case "system-alerts": return <div className={base}><WidgetErrorBoundary name="System Alerts"><MemoizedSystemAlertsWidget /></WidgetErrorBoundary></div>;
      case "holo-globe": return (<div className={`jarvis-box-glow jarvis-corner-brackets relative flex items-center justify-center overflow-hidden rounded-xl border jarvis-border-cyan bg-card/20 p-2 backdrop-blur-sm ${base}`}><div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" /><WidgetErrorBoundary name="Holo Globe"><MemoizedHoloGlobe size={220} /></WidgetErrorBoundary></div>);
      case "session-stats": return <div className={base}><WidgetErrorBoundary name="Session Stats"><MemoizedSessionStatsWidget /></WidgetErrorBoundary></div>;
      case "shortcuts": return <div className={base}><WidgetErrorBoundary name="Shortcuts"><MemoizedShortcutsWidget /></WidgetErrorBoundary></div>;
      case "file-explorer": return <div className={base}><WidgetErrorBoundary name="File Explorer"><MemoizedFileExplorerWidget /></WidgetErrorBoundary></div>;
      case "calendar": return <div className={base}><WidgetErrorBoundary name="Calendar"><MemoizedCalendarWidget /></WidgetErrorBoundary></div>;
      case "github": return <div className={base}><WidgetErrorBoundary name="GitHub"><MemoizedGitHubWidget /></WidgetErrorBoundary></div>;
      default: return null;
    }
  }, []);

  return (
    <aside className="jarvis-scroll flex flex-col gap-3 lg:col-span-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
      {dndMode ? (
        <DndWidgetList widgetIds={leftWidgetIds} onReorder={setLeftWidgetIds} columnId="left">
          {(widgetId) => renderLeftWidget(widgetId)}
        </DndWidgetList>
      ) : (
        <>
          {/* Quick Launch */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
            <WidgetErrorBoundary name="Quick Launch"><MemoizedQuickLaunchWidget /></WidgetErrorBoundary>
          </motion.div>

          <motion.div className="jarvis-holo-glitch jarvis-crt-noise flex-shrink-0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.6 }}>
            <WidgetErrorBoundary name="System Diagnostics"><MemoizedSystemMonitor /></WidgetErrorBoundary>
          </motion.div>

          {/* Metrics History Chart */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22, duration: 0.6 }}>
            <JarvisSuspense><LazyMetricsHistoryChart /></JarvisSuspense>
          </motion.div>

          {/* Activity Feed */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.32, duration: 0.5 }}>
            <WidgetErrorBoundary name="Activity Feed"><MemoizedActivityFeed /></WidgetErrorBoundary>
          </motion.div>

          {/* System Alerts Widget */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.33, duration: 0.5 }}>
            <WidgetErrorBoundary name="System Alerts"><MemoizedSystemAlertsWidget /></WidgetErrorBoundary>
          </motion.div>

          {/* Holographic Globe */}
          <motion.div className="jarvis-box-glow jarvis-corner-brackets relative flex items-center justify-center overflow-hidden rounded-xl border jarvis-border-cyan bg-card/20 p-2 backdrop-blur-sm" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35, duration: 0.6 }}>
            <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
            <WidgetErrorBoundary name="Holo Globe"><MemoizedHoloGlobe size={220} /></WidgetErrorBoundary>
          </motion.div>

          {/* Session Stats */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.36, duration: 0.5 }}>
            <WidgetErrorBoundary name="Session Stats"><MemoizedSessionStatsWidget /></WidgetErrorBoundary>
          </motion.div>

          {/* Keyboard Shortcuts */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.37, duration: 0.5 }}>
            <WidgetErrorBoundary name="Shortcuts"><MemoizedShortcutsWidget /></WidgetErrorBoundary>
          </motion.div>

          {/* File Explorer */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.38, duration: 0.5 }}>
            <WidgetErrorBoundary name="File Explorer"><MemoizedFileExplorerWidget /></WidgetErrorBoundary>
          </motion.div>

          {/* Calendar */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.39, duration: 0.5 }}>
            <WidgetErrorBoundary name="Calendar"><MemoizedCalendarWidget /></WidgetErrorBoundary>
          </motion.div>
        </>
      )}
      <motion.div className="jarvis-box-glow jarvis-corner-brackets relative min-h-[160px] flex-1 overflow-hidden rounded-xl border jarvis-border-cyan bg-card/40 p-3 backdrop-blur-sm lg:min-h-0" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
        <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
        <ConversationList conversations={jarvis.conversations} activeId={jarvis.activeConvoId} onSelect={jarvis.selectConversation} onNew={jarvis.newConversation} onDelete={jarvis.deleteConversation} />
      </motion.div>
    </aside>
  );
}