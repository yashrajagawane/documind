import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  WorkspaceSplitter,
  DEFAULT_CHAT_WIDTH,
  MIN_CHAT_WIDTH,
  MAX_CHAT_WIDTH,
} from "./WorkspaceSplitter";

describe("WorkspaceSplitter", () => {
  const mockResize = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.className = "";
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1440,
    });
  });

  afterEach(() => {
    document.body.className = "";
  });

  it("renders accessible separator with expected ARIA attributes", () => {
    render(
      <WorkspaceSplitter
        chatWidth={380}
        onResize={mockResize}
        onReset={mockReset}
      />
    );

    const separator = screen.getByRole("separator", { name: "Resize chat panel" });
    expect(separator).toBeInTheDocument();
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuenow", "380");
    expect(separator).toHaveAttribute("aria-valuemin", String(MIN_CHAT_WIDTH));
    expect(separator).toHaveAttribute("aria-valuemax", String(MAX_CHAT_WIDTH));
    expect(separator).toHaveAttribute("tabindex", "0");
  });

  it("keyboard navigation: nudges chat width with ArrowLeft (+20px) and ArrowRight (-20px)", () => {
    render(
      <WorkspaceSplitter
        chatWidth={380}
        onResize={mockResize}
        onReset={mockReset}
      />
    );

    const separator = screen.getByRole("separator", { name: "Resize chat panel" });

    // ArrowLeft expands chat panel
    fireEvent.keyDown(separator, { key: "ArrowLeft" });
    expect(mockResize).toHaveBeenCalledWith(400);

    // ArrowRight shrinks chat panel
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(mockResize).toHaveBeenCalledWith(360);
  });

  it("keyboard navigation: Home sets minimum and End sets maximum width", () => {
    render(
      <WorkspaceSplitter
        chatWidth={380}
        onResize={mockResize}
        onReset={mockReset}
      />
    );

    const separator = screen.getByRole("separator", { name: "Resize chat panel" });

    fireEvent.keyDown(separator, { key: "Home" });
    expect(mockResize).toHaveBeenCalledWith(MIN_CHAT_WIDTH);

    fireEvent.keyDown(separator, { key: "End" });
    expect(mockResize).toHaveBeenCalledWith(MAX_CHAT_WIDTH);
  });

  it("clamps maximum width on constrained viewports to preserve preview minimum space", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    render(
      <WorkspaceSplitter
        chatWidth={380}
        onResize={mockResize}
        onReset={mockReset}
      />
    );

    const separator = screen.getByRole("separator", { name: "Resize chat panel" });

    // On 1024px: sidebar (220px) + preview min (400px) + 1px splitter leaves max 403px for chat
    fireEvent.keyDown(separator, { key: "End" });
    expect(mockResize).toHaveBeenCalledWith(403);
  });

  it("resets to default width on Enter and on double click", () => {
    render(
      <WorkspaceSplitter
        chatWidth={460}
        onResize={mockResize}
        onReset={mockReset}
      />
    );

    const separator = screen.getByRole("separator", { name: "Resize chat panel" });

    // Enter triggers reset
    fireEvent.keyDown(separator, { key: "Enter" });
    expect(mockReset).toHaveBeenCalledTimes(1);

    // Double click triggers reset
    fireEvent.doubleClick(separator);
    expect(mockReset).toHaveBeenCalledTimes(2);
  });

  it("mouse/pointer drag: tracks pointermove and updates width clamped within boundaries", () => {
    render(
      <WorkspaceSplitter
        chatWidth={380}
        onResize={mockResize}
        onReset={mockReset}
      />
    );

    const separator = screen.getByRole("separator", { name: "Resize chat panel" });

    // Start drag
    fireEvent.mouseDown(separator, { button: 0 });
    expect(document.body).toHaveClass("is-resizing");

    // Move pointer to clientX = 1000 -> chat width = 1440 - 1000 = 440
    fireEvent(window, new MouseEvent("mousemove", { clientX: 1000 }));
    expect(mockResize).toHaveBeenCalledWith(440);

    // End drag
    fireEvent(window, new MouseEvent("mouseup"));
    expect(document.body).not.toHaveClass("is-resizing");
  });

  it("falls back to default width when onReset prop is not provided", () => {
    render(
      <WorkspaceSplitter
        chatWidth={480}
        onResize={mockResize}
      />
    );

    const separator = screen.getByRole("separator", { name: "Resize chat panel" });
    fireEvent.keyDown(separator, { key: "Enter" });
    expect(mockResize).toHaveBeenCalledWith(DEFAULT_CHAT_WIDTH);
  });
});
