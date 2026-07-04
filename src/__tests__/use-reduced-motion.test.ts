import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

describe("useReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    // Default: no reduced motion
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  it("returns false when reduced motion is not preferred", async () => {
    const { useReducedMotion } = await import("@/hooks/use-reduced-motion");
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when reduced motion is preferred", async () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn((_event, handler) => { changeHandler = handler; }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const { useReducedMotion } = await import("@/hooks/use-reduced-motion");
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it("updates when media query changes", async () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn((_event, handler) => { changeHandler = handler; }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const { useReducedMotion } = await import("@/hooks/use-reduced-motion");
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      changeHandler!({ matches: true } as MediaQueryListEvent);
    });
    expect(result.current).toBe(true);
  });
});