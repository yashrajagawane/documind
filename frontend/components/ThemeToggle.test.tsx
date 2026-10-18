import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";

import { ThemeProvider } from "@/lib/theme-context";
import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle Component and Theme System", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("renders theme toggle button with accessible aria-label", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: /Switch to light theme/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Switch to light theme");
  });

  it("toggles theme from dark to light on click and updates localStorage and documentElement", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button", { name: /Switch to light theme/i });
    fireEvent.click(button);

    // After click: switches to light theme, next theme is dark
    expect(screen.getByRole("button", { name: /Switch to dark theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(localStorage.getItem("documind-theme")).toBe("light");

    // Click again: switches back to dark
    fireEvent.click(screen.getByRole("button", { name: /Switch to dark theme/i }));
    expect(screen.getByRole("button", { name: /Switch to light theme/i })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(localStorage.getItem("documind-theme")).toBe("dark");
  });
});
