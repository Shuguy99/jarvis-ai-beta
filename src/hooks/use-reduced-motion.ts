"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Returns true if the user has enabled "reduced motion" in their OS settings.
 * Used to disable JS-driven animations (framer-motion, rAF loops, etc.)
 * when CSS `@media (prefers-reduced-motion: reduce)` is not sufficient.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return reduced;
}