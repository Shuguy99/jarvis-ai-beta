import { useRef, useEffect, useCallback } from "react";

/**
 * Hook that traps focus within a container element while `isOpen` is true.
 * Returns a ref to attach to the outermost container div of the modal.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
) {
  const containerRef = useRef<T | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !containerRef.current) return;

      const focusable = containerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

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
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    const prev = document.activeElement as HTMLElement | null;

    // Focus the first focusable element inside the container
    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    } else if (containerRef.current) {
      containerRef.current.focus();
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus on close
      prev?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  return { containerRef };
}

/**
 * Returns ARIA overlay props for a modal/dialog element.
 */
export function getOverlayProps(
  label: string,
  isOpen: boolean,
): {
  role: "dialog";
  "aria-modal": true;
  "aria-label": string;
  "aria-hidden": boolean;
} {
  return {
    role: "dialog",
    "aria-modal": true,
    "aria-label": label,
    "aria-hidden": !isOpen,
  };
}