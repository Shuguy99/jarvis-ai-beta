import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from "vitest";
import { renderHook, act } from "@testing-library/react";

let useHotkeys: typeof import("@/hooks/use-hotkeys").useHotkeys;
let useLayout: typeof import("@/hooks/use-layout").useLayout;

beforeAll(async () => {
  ({ useHotkeys } = await import("@/hooks/use-hotkeys"));
  ({ useLayout } = await import("@/hooks/use-layout"));
});

// ── useHotkeys ──────────────────────────────────────────────

describe("useHotkeys", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("registers keydown listener on mount", () => {
    renderHook(() => useHotkeys({}));
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("removes keydown listener on unmount", () => {
    const { unmount } = renderHook(() => useHotkeys({}));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
  });

  it("calls onToggleTimer on Ctrl+1", () => {
    const onToggleTimer = vi.fn();
    renderHook(() => useHotkeys({ onToggleTimer }));

    const handler = addSpy.mock.calls[0][1] as EventListener;
    act(() => {
      handler(new KeyboardEvent("keydown", { key: "1", ctrlKey: true }));
    });
    expect(onToggleTimer).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenSettings on Ctrl+/", () => {
    const onOpenSettings = vi.fn();
    renderHook(() => useHotkeys({ onOpenSettings }));

    const handler = addSpy.mock.calls[0][1] as EventListener;
    act(() => {
      handler(new KeyboardEvent("keydown", { key: "/", ctrlKey: true }));
    });
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("calls onNewChat on Ctrl+Shift+N", () => {
    const onNewChat = vi.fn();
    renderHook(() => useHotkeys({ onNewChat }));

    const handler = addSpy.mock.calls[0][1] as EventListener;
    act(() => {
      handler(new KeyboardEvent("keydown", { key: "N", ctrlKey: true, shiftKey: true }));
    });
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleFullscreen on F11", () => {
    const onToggleFullscreen = vi.fn();
    renderHook(() => useHotkeys({ onToggleFullscreen }));

    const handler = addSpy.mock.calls[0][1] as EventListener;
    act(() => {
      handler(new KeyboardEvent("keydown", { key: "F11" }));
    });
    expect(onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenPalette on Ctrl+K", () => {
    const onOpenPalette = vi.fn();
    renderHook(() => useHotkeys({ onOpenPalette }));

    const handler = addSpy.mock.calls[0][1] as EventListener;
    act(() => {
      handler(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    });
    expect(onOpenPalette).toHaveBeenCalledTimes(1);
  });
});

// ── useLayout ────────────────────────────────────────────────

describe("useLayout", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns default widgets on first load", () => {
    const { result } = renderHook(() => useLayout());
    expect(result.current.widgets.length).toBeGreaterThan(0);
    expect(result.current.presets.length).toBe(5);
  });

  it("setWidgetVisible toggles visibility", () => {
    const { result } = renderHook(() => useLayout());

    const widget = result.current.widgets.find(
      (w) => !w.pinned && w.visible
    );
    if (!widget) return;

    act(() => {
      result.current.setWidgetVisible(widget.id, false);
    });
    expect(
      result.current.widgets.find((w) => w.id === widget.id)?.visible
    ).toBe(false);
    expect(result.current.activePresetId).toBe("custom");
  });

  it("does not hide pinned widgets", () => {
    const { result } = renderHook(() => useLayout());

    const pinned = result.current.widgets.find((w) => w.pinned);
    if (!pinned) return;

    act(() => {
      result.current.setWidgetVisible(pinned.id, false);
    });
    expect(
      result.current.widgets.find((w) => w.id === pinned.id)?.visible
    ).toBe(true);
  });

  it("applyPreset changes visible widgets", () => {
    const { result } = renderHook(() => useLayout());

    const initialVisible = result.current.widgets.filter((w) => w.visible).length;

    act(() => {
      result.current.applyPreset("minimal");
    });

    const minimalVisible = result.current.widgets.filter((w) => w.visible).length;
    expect(minimalVisible).toBeLessThan(initialVisible);
    expect(result.current.activePresetId).toBe("minimal");
  });

  it("resetToDefault shows all widgets", () => {
    const { result } = renderHook(() => useLayout());

    act(() => {
      result.current.applyPreset("minimal");
    });
    act(() => {
      result.current.resetToDefault();
    });

    const allVisible = result.current.widgets.every(
      (w) => w.visible || w.pinned
    );
    expect(allVisible).toBe(true);
    expect(result.current.activePresetId).toBe("full-hud");
  });

  it("presets include expected IDs", () => {
    const { result } = renderHook(() => useLayout());
    const ids = result.current.presets.map((p) => p.id);
    expect(ids).toContain("full-hud");
    expect(ids).toContain("minimal");
    expect(ids).toContain("developer");
    expect(ids).toContain("focus");
    expect(ids).toContain("monitoring");
  });
});