import { render, screen, fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";

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

test("sanitizes malicious script tags and inline event handlers to prevent XSS", () => {
  const maliciousMarkdown = [
    "# Safe Title",
    "<" + "script>window.__xss_executed = true;</" + "script>",
    '<img src="invalid-image.png" onerror="window.__xss_onerror = true;" />',
    "<" + 'iframe src="https://evil.com"></' + "iframe>",
    "Safe paragraph content.",
  ].join("\n");

  const { container } = render(<MarkdownRenderer content={maliciousMarkdown} />);

  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("iframe")).toBeNull();
  const img = container.querySelector("img");
  if (img) {
    expect(img.hasAttribute("onerror")).toBe(false);
  }
  expect(screen.getByText("Safe paragraph content.")).toBeInTheDocument();
});

test("sanitizes dangerous javascript: URI schemes in links", () => {
  const maliciousLink = "[Click me](javascript:alert('xss'))";
  const { container } = render(<MarkdownRenderer content={maliciousLink} />);

  const link = container.querySelector("a");
  if (link) {
    const href = link.getAttribute("href");
    expect(href === null || !href.includes("javascript:")).toBe(true);
  }
});

test("safely escapes quotes in heading data-section attributes", () => {
  const quotedHeading = '# Analysis of "Q3 Revenue" Results';
  render(<MarkdownRenderer content={quotedHeading} />);

  const heading = screen.getByRole("heading", { level: 1 });
  expect(heading).toBeInTheDocument();
  expect(heading.getAttribute("data-section")).toBe('Analysis of "Q3 Revenue" Results');
  expect(heading.textContent).toContain('Analysis of "Q3 Revenue" Results');
});

test("renders code blocks with syntax token classes and language badge", () => {
  const markdown = `
\`\`\`python
# Configuration loader
def get_config():
    return {"status": True}
\`\`\`
`;
  const { container } = render(<MarkdownRenderer content={markdown} />);

  expect(screen.getByText("PYTHON")).toBeInTheDocument();
  expect(container.querySelector(".token-comment")).toHaveTextContent("# Configuration loader");
  expect(container.querySelector(".token-keyword")).toHaveTextContent("def");
  expect(container.querySelector(".token-boolean")).toHaveTextContent("True");
  expect(screen.getByRole("button", { name: "Copy code block" })).toBeInTheDocument();
});

test("clicking copy button in code block writes code to clipboard and updates label", async () => {
  const writeTextSpy = vi.fn().mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: { writeText: writeTextSpy },
  });

  const markdown = `
\`\`\`sql
SELECT id, title FROM documents WHERE status = 'ready';
\`\`\`
`;
  render(<MarkdownRenderer content={markdown} />);

  const copyBtn = screen.getByRole("button", { name: "Copy code block" });
  expect(copyBtn).toHaveTextContent("Copy");

  fireEvent.click(copyBtn);

  expect(writeTextSpy).toHaveBeenCalled();
  expect(copyBtn).toHaveTextContent("✓ Copied");
});

