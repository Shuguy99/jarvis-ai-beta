"use client";

import { lazy, Suspense, type ReactNode } from "react";

// Lazy-loaded overlays — only loaded when opened
export const LazyAgentPanel = lazy(() =>
  import("@/components/jarvis/agent-panel").then((m) => ({
    default: m.AgentPanel,
  }))
);
export const LazyPluginPanel = lazy(() =>
  import("@/components/jarvis/plugin-panel").then((m) => ({
    default: m.PluginPanel,
  }))
);
export const LazyLayoutCustomizer = lazy(() =>
  import("@/components/jarvis/layout-customizer").then((m) => ({
    default: m.LayoutCustomizer,
  }))
);
export const LazyNotificationCenter = lazy(() =>
  import("@/components/jarvis/notification-center").then((m) => ({
    default: m.NotificationCenter,
  }))
);
export const LazySettingsPanel = lazy(() =>
  import("@/components/jarvis/settings-panel").then((m) => ({
    default: m.SettingsPanel,
  }))
);
export const LazyMarkdownWidget = lazy(() =>
  import("@/components/jarvis/markdown-widget").then((m) => ({
    default: m.MarkdownWidget,
  }))
);
export const LazyMetricsHistoryChart = lazy(() =>
  import("@/components/jarvis/metrics-history-chart")
);

// HUD-style loading fallback
export function JarvisSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}