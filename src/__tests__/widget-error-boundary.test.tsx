import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock playSound
vi.mock("@/lib/sounds", () => ({ playSound: vi.fn() }));

describe("WidgetErrorBoundary", () => {
  it("renders children when no error", async () => {
    const { WidgetErrorBoundary } = await import("@/components/jarvis/widget-error-boundary");
    render(
      <WidgetErrorBoundary name="TestWidget">
        <div data-testid="child">Hello</div>
      </WidgetErrorBoundary>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });

  it("shows error UI when child throws", async () => {
    const { WidgetErrorBoundary } = await import("@/components/jarvis/widget-error-boundary");

    const ThrowingChild = () => {
      throw new Error("test crash");
    };

    // Suppress console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <WidgetErrorBoundary name="BadWidget">
        <ThrowingChild />
      </WidgetErrorBoundary>
    );

    expect(screen.getByText(/BadWidget Error/i)).toBeTruthy();
    expect(screen.getByText("test crash")).toBeTruthy();
    expect(screen.getByRole("button", { name: /retry/i })).toBeTruthy();

    spy.mockRestore();
  });

  it("shows custom fallback when provided", async () => {
    const { WidgetErrorBoundary } = await import("@/components/jarvis/widget-error-boundary");

    const ThrowingChild = () => {
      throw new Error("boom");
    };

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <WidgetErrorBoundary fallback={<div data-testid="custom-fallback">Custom Error</div>}>
        <ThrowingChild />
      </WidgetErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toHaveTextContent("Custom Error");

    spy.mockRestore();
  });
});