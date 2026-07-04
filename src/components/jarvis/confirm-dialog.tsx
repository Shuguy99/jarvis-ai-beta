"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useFocusTrap, getOverlayProps } from "@/lib/a11y-utils";
import { playSound } from "@/lib/sounds";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const trapRef = useFocusTrap(open);

  const handleConfirm = useCallback(() => {
    playSound("warning", 0.2);
    onConfirm();
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    playSound("deactivate", 0.3);
    onCancel();
  }, [onCancel]);

  const handleBackdrop = useCallback(() => {
    playSound("deactivate", 0.3);
    onCancel();
  }, [onCancel]);

  const dangerBtn = variant === "danger"
    ? "border-rose-500/40 bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 hover:border-rose-500/60"
    : "border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 hover:border-amber-500/60";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleBackdrop}
        >
          <motion.div
            ref={trapRef}
            {...getOverlayProps(title, open)}
            className="jarvis-glass-strong jarvis-box-glow w-full max-w-sm overflow-hidden rounded-xl border jarvis-border-cyan"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative corners */}
            <div className="pointer-events-none absolute left-2 top-2 h-4 w-4 border-l-2 border-t-2 border-primary/30" />
            <div className="pointer-events-none absolute right-2 top-2 h-4 w-4 border-r-2 border-t-2 border-primary/30" />
            <div className="pointer-events-none absolute bottom-2 left-2 h-4 w-4 border-b-2 border-l-2 border-primary/30" />
            <div className="pointer-events-none absolute bottom-2 right-2 h-4 w-4 border-b-2 border-r-2 border-primary/30" />

            <div className="p-5">
              {/* Icon + Title */}
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                  variant === "danger"
                    ? "border-rose-500/30 bg-rose-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                }`}>
                  <AlertTriangle className={`h-4 w-4 ${
                    variant === "danger" ? "text-rose-400" : "text-amber-400"
                  }`} />
                </div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-widest text-foreground">
                  {title}
                </h3>
              </div>

              {/* Message */}
              <p className="mb-5 font-mono text-xs leading-relaxed text-muted-foreground/80">
                {message}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="rounded-lg border border-muted-foreground/20 bg-muted/10 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={handleConfirm}
                  className={`rounded-lg border px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition ${dangerBtn}`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Hook for managing confirm dialog state.
 * Usage:
 *   const { confirmState, requestConfirm, resolveConfirm, resolveCancel } = useConfirmState();
 *   // render <ConfirmDialog {...confirmState} onConfirm={resolveConfirm} onCancel={resolveCancel} />
 *   const confirmed = await requestConfirm({ title: "...", message: "..." });
 *   if (confirmed) { /* do destructive action *\/ }
 */
export function useConfirmState() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    variant: "danger" | "warning";
    resolve: (_value: boolean) => void;
  }>({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Подтвердить",
    cancelLabel: "Отмена",
    variant: "danger",
    resolve: () => {},
  });

  const requestConfirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      variant?: "danger" | "warning";
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        setState({
          open: true,
          title: opts.title,
          message: opts.message,
          confirmLabel: opts.confirmLabel ?? "Подтвердить",
          cancelLabel: opts.cancelLabel ?? "Отмена",
          variant: opts.variant ?? "danger",
          resolve,
        });
      });
    },
    []
  );

  const resolveConfirm = useCallback(() => {
    setState((prev) => {
      prev.resolve(true);
      return { ...prev, open: false };
    });
  }, []);

  const resolveCancel = useCallback(() => {
    setState((prev) => {
      prev.resolve(false);
      return { ...prev, open: false };
    });
  }, []);

  return {
    confirmState: state,
    requestConfirm,
    resolveConfirm,
    resolveCancel,
  };
}