

import { useEffect, useRef, useCallback, type ReactNode } from "react";

/**
 * Focus trap hook — keeps focus within a container when open.
 * Traps Tab/Shift+Tab, returns focus to triggerRef on close.
 */
export function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus first focusable element in container
    const container = containerRef.current;
    if (container) {
      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus on close
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  return containerRef;
}

/**
 * Screen reader only text utility component
 */
export function SrOnly({ children }: { children: ReactNode }) {
  return (
    <span className="sr-only">
      {children}
    </span>
  );
}

/**
 * Announces a message to screen readers via aria-live region.
 * Returns a ref to attach to the live region div.
 */
export function useAriaAnnounce() {
  const ref = useRef<HTMLDivElement>(null);

  const announce = useCallback((message: string, priority: "polite" | "assertive" = "polite") => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute("aria-live", priority);
    el.textContent = message;
    // Clear after announcement
    setTimeout(() => { el.textContent = ""; }, 1000);
  }, []);

  return { announceRef: ref, announce };
}

/**
 * VisuallyHidden component — same as SrOnly but with more control
 */
export function VisuallyHidden({ children, as: Tag = "span" }: { children: ReactNode; as?: "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "label" }) {
  return (
    <Tag className="absolute h-px w-px overflow-hidden whitespace-nowrap border-0 p-0 [clip:rect(0,0,0,0)]">
      {children}
    </Tag>
  );
}

/**
 * ARIA overlay props generator — returns standard overlay props for modal dialogs.
 */
export function getOverlayProps(label: string, isOpen: boolean) {
  return {
    role: "dialog" as const,
    "aria-modal": true as const,
    "aria-label": label,
    "aria-hidden": !isOpen,
  };
}