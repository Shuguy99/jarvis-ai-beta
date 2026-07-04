import { describe, it, expect, vi } from "vitest";

// Mock matchMedia
const matchMediaMock = vi.fn().mockReturnValue({
  matches: false,
  media: "(prefers-reduced-motion: reduce)",
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: matchMediaMock,
});

describe("a11y-utils", () => {
  describe("getOverlayProps", () => {
    it("returns correct props when open", async () => {
      const { getOverlayProps } = await import("@/lib/a11y-utils");
      const props = getOverlayProps("Test Dialog", true);
      expect(props.role).toBe("dialog");
      expect(props["aria-modal"]).toBe(true);
      expect(props["aria-label"]).toBe("Test Dialog");
      expect(props["aria-hidden"]).toBe(false);
    });

    it("returns aria-hidden true when closed", async () => {
      const { getOverlayProps } = await import("@/lib/a11y-utils");
      const props = getOverlayProps("Test", false);
      expect(props["aria-hidden"]).toBe(true);
    });
  });
});