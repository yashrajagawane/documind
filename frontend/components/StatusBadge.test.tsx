import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { StatusBadge } from "./StatusBadge";

test("renders status label correctly", () => {
  render(<StatusBadge status="ready" />);
  expect(screen.getByText("ready")).toBeInTheDocument();
});

test("renders stage and progress bar when processing", () => {
  render(<StatusBadge status="processing" stage="extracting" progress={45} />);
  expect(screen.getByText("processing (extracting)")).toBeInTheDocument();
  expect(screen.getByLabelText("Processing progress: 45%")).toBeInTheDocument();
});
