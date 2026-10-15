import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { StatusBadge } from "./StatusBadge";

test("renders status label correctly", () => {
  render(<StatusBadge status="ready" />);
  expect(screen.getByText("ready")).toBeInTheDocument();
});

test("renders stage and progress bar with proper ARIA attributes when processing", () => {
  render(<StatusBadge status="processing" stage="extracting" progress={45} />);
  expect(screen.getByText("processing (extracting)")).toBeInTheDocument();
  const progressBar = screen.getByRole("progressbar");
  expect(progressBar).toBeInTheDocument();
  expect(progressBar).toHaveAttribute("aria-valuenow", "45");
  expect(progressBar).toHaveAttribute("aria-valuemin", "0");
  expect(progressBar).toHaveAttribute("aria-valuemax", "100");
  expect(progressBar).toHaveAttribute("aria-label", "Processing progress for extracting: 45%");
});
