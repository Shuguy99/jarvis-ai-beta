/**
 * Plugin Sandbox Panel
 *
 * Generic panel renderer for plugin UI panels.
 * Each PluginPanelDef is rendered in an isolated container.
 * For now, renders a placeholder with the panel title.
 * In a full implementation, this would use an iframe with postMessage
 * or a Shadow DOM boundary for CSS isolation.
 *
 * Settings are passed as props (simplified alternative to postMessage).
 */

import type { PluginPanelDef } from "@/lib/types";

interface PluginSandboxPanelProps {
  panel: PluginPanelDef;
  settings?: Record<string, unknown>;
}

/**
 * Renders a single plugin panel in an isolated container.
 * TODO: Replace the placeholder with an iframe-based renderer that loads
 * the plugin component in a sandboxed environment and communicates via
 * postMessage. The settings would be sent via an initial postMessage call
 * and updated when the parent receives setting-change events.
 */
export function PluginSandboxPanel({ panel, settings }: PluginSandboxPanelProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-primary/10 bg-card/30 backdrop-blur-sm">
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b border-border/10 px-3 py-2">
        <div className="flex h-6 w-6 items-center justify-center rounded border border-primary/15 bg-primary/5">
          <span className="font-mono text-[10px] text-primary/60">
            {panel.icon ? panel.icon.charAt(0) : "P"}
          </span>
        </div>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-foreground/70">
          {panel.title}
        </span>
        <span className="ml-auto font-mono text-[8px] text-muted-foreground/25">
          sandbox
        </span>
      </div>

      {/* Simulated iframe container */}
      <div className="flex-1 p-4">
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border/20 bg-background/20">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 bg-primary/5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-primary/40"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9 3 3-3 3" />
            </svg>
          </div>
          <div className="text-center">
            <p className="font-mono text-xs text-muted-foreground/50">
              {panel.title} Panel
            </p>
            <p className="mt-1 max-w-[200px] font-mono text-[9px] text-muted-foreground/30">
              Plugin panel content would render here in a sandboxed iframe.
            </p>
          </div>

          {/* Show settings preview if any */}
          {settings && Object.keys(settings).length > 0 && (
            <div className="mt-2 w-full max-w-[220px] rounded border border-border/15 bg-background/30 p-2">
              <span className="mb-1 block font-mono text-[8px] uppercase tracking-widest text-muted-foreground/30">
                Settings
              </span>
              {Object.entries(settings).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-0.5">
                  <span className="font-mono text-[9px] text-muted-foreground/40">{key}</span>
                  <span className="font-mono text-[9px] text-foreground/50">
                    {String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Panel footer */}
      <div className="border-t border-border/10 px-3 py-1.5">
        <span className="font-mono text-[7px] text-muted-foreground/20">
          component: {panel.component} · position: {panel.position}
        </span>
      </div>
    </div>
  );
}