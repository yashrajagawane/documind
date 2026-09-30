import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { AppProviders } from "./AppProviders";

test("renders children through application providers", () => {
  render(<AppProviders><p>Foundation ready</p></AppProviders>);
  expect(screen.getByText("Foundation ready")).toBeInTheDocument();
});
