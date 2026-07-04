

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { playSound } from "@/lib/sounds";

interface Props {
  children: ReactNode;
  /** Widget name shown in the error UI */
  name?: string;
  /** Optional fallback UI — if not provided, a default HUD-style error is rendered */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors in a single widget, preventing the entire
 * page from crashing. Shows a HUD-styled error panel with a retry button.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[WidgetErrorBoundary${this.props.name ? `: ${this.props.name}` : ""}]`, error, info.componentStack);
    try { playSound("error", 0.3); } catch { /* ignore */ }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="jarvis-box-glow jarvis-corner-brackets relative overflow-hidden rounded-xl border border-destructive/30 bg-card/60 p-4 backdrop-blur-sm animate-in fade-in-0 duration-300">
          <div className="jarvis-corner-brackets-inner absolute inset-0 rounded-xl" />
          <div className="pointer-events-none absolute inset-0 jarvis-grid-bg opacity-20" />
          <div className="relative flex flex-col items-center gap-3 py-4">
            <AlertTriangle className="h-8 w-8 text-destructive/70 anim-pulse-glow" />
            <div className="text-center">
              <p className="font-mono text-xs uppercase tracking-widest text-destructive/90">
                {this.props.name ? `${this.props.name} Error` : "Component Error"}
              </p>
              <p className="mt-1 max-w-[200px] font-mono text-[10px] text-muted-foreground">
                {this.state.error?.message ?? "Unknown error"}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-1.5 rounded-md border jarvis-border-cyan bg-primary/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground transition hover:border-primary/50 hover:text-primary"
              aria-label="Retry"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}