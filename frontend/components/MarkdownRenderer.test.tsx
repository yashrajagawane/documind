import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { MarkdownRenderer } from "./MarkdownRenderer";

test("renders headings with predictable section IDs for citation navigation", () => {
  const markdown = "# Executive Summary\n\nThis is the executive summary paragraph.";
  const { container } = render(<MarkdownRenderer content={markdown} />);

  const heading = screen.getByRole("heading", { level: 1, name: "Executive Summary" });
  expect(heading).toBeInTheDocument();
  expect(heading).toHaveAttribute("id", "sec-executive-summary");
  expect(heading).toHaveAttribute("data-section", "Executive Summary");
  expect(container.textContent).toContain("This is the executive summary paragraph.");
});

test("renders bullet lists, bold text, and code blocks correctly", () => {
  const markdown = `
**Key Findings:**
* First point
* Second point

\`\`\`json
{"status": "ok"}
\`\`\`
`;
  const { container } = render(<MarkdownRenderer content={markdown} />);

  expect(screen.getByText("Key Findings:")).toBeInTheDocument();
  expect(screen.getByText("First point")).toBeInTheDocument();
  expect(screen.getByText("Second point")).toBeInTheDocument();
  expect(container.querySelector("pre.code-block")).toBeInTheDocument();
  expect(container.textContent).toContain('{"status": "ok"}');
});

test("renders tables with application table styling", () => {
  const markdown = `
| Column A | Column B |
| --- | --- |
| Val 1 | Val 2 |
`;
  const { container } = render(<MarkdownRenderer content={markdown} />);

  expect(container.querySelector("table.table-viewer")).toBeInTheDocument();
  expect(screen.getByText("Column A")).toBeInTheDocument();
  expect(screen.getByText("Val 1")).toBeInTheDocument();
});
