import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentPreview } from "./DocumentPreview";
import type { DocumentPreview as DocumentPreviewType } from "@/lib/types";

const mockPreview: DocumentPreviewType = {
  id: "doc-123",
  original_name: "Annual_Report_2026.pdf",
  checksum_sha256: "abc123sha256",
  status: "ready",
  processing_stage: null,
  processing_progress: 100,
  created_at: "2026-10-15T10:00:00Z",
  markdown: "# Annual Report 2026\n\nRevenue grew by 24% year-over-year.",
  tables: [
    {
      markdown: "| Metric | Value |\n| --- | --- |\n| Revenue | $12M |",
      rows: [{ Metric: "Revenue", Value: "$12M" }],
      columns: ["Metric", "Value"],
    },
  ],
  metadata: {
    word_count: 520,
    character_count: 3100,
    page_count: 4,
  },
};

describe("DocumentPreview Accessibility and Interactions", () => {
  it("renders document header with metadata", () => {
    render(<DocumentPreview preview={mockPreview} onDownload={vi.fn()} />);

    expect(screen.getByText("Annual_Report_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText(/520 words/i)).toBeInTheDocument();
    expect(screen.getByText(/3,100 chars/i)).toBeInTheDocument();
    expect(screen.getByText(/1 table/i)).toBeInTheDocument();
  });

  it("renders accessible tablist and tabpanel pairing", () => {
    render(<DocumentPreview preview={mockPreview} onDownload={vi.fn()} />);

    const tablist = screen.getByRole("tablist", { name: "Document view tabs" });
    expect(tablist).toBeInTheDocument();

    const markdownTab = screen.getByRole("tab", { name: "Markdown Content" });
    const tablesTab = screen.getByRole("tab", { name: /Extracted Tables/i });

    expect(markdownTab).toHaveAttribute("id", "tab-markdown");
    expect(markdownTab).toHaveAttribute("aria-controls", "panel-markdown");
    expect(markdownTab).toHaveAttribute("aria-selected", "true");

    expect(tablesTab).toHaveAttribute("id", "tab-tables");
    expect(tablesTab).toHaveAttribute("aria-controls", "panel-tables");
    expect(tablesTab).toHaveAttribute("aria-selected", "false");

    const markdownPanel = screen.getByRole("tabpanel");
    expect(markdownPanel).toHaveAttribute("id", "panel-markdown");
    expect(markdownPanel).toHaveAttribute("aria-labelledby", "tab-markdown");
  });

  it("switches to extracted tables panel when tab is clicked", () => {
    render(<DocumentPreview preview={mockPreview} onDownload={vi.fn()} />);

    const tablesTab = screen.getByRole("tab", { name: /Extracted Tables/i });
    fireEvent.click(tablesTab);

    expect(tablesTab).toHaveAttribute("aria-selected", "true");
    const tablesPanel = screen.getByRole("tabpanel");
    expect(tablesPanel).toHaveAttribute("id", "panel-tables");
    expect(tablesPanel).toHaveAttribute("aria-labelledby", "tab-tables");
    expect(screen.getByText("Metric")).toBeInTheDocument();
    expect(screen.getByText("$12M")).toBeInTheDocument();
  });

  it("supports arrow key navigation across tabs", () => {
    render(<DocumentPreview preview={mockPreview} onDownload={vi.fn()} />);

    const markdownTab = screen.getByRole("tab", { name: "Markdown Content" });
    const tablesTab = screen.getByRole("tab", { name: /Extracted Tables/i });

    // Press ArrowRight from markdown tab -> switches to tables tab
    fireEvent.keyDown(markdownTab, { key: "ArrowRight" });
    expect(tablesTab).toHaveAttribute("aria-selected", "true");

    // Press ArrowLeft from tables tab -> switches back to markdown tab
    fireEvent.keyDown(tablesTab, { key: "ArrowLeft" });
    expect(markdownTab).toHaveAttribute("aria-selected", "true");
  });

  it("toggles between rendered and raw markdown views with aria-pressed", () => {
    render(<DocumentPreview preview={mockPreview} onDownload={vi.fn()} />);

    const renderedBtn = screen.getByRole("button", { name: "Rendered" });
    const rawBtn = screen.getByRole("button", { name: "Raw Source" });

    expect(renderedBtn).toHaveAttribute("aria-pressed", "true");
    expect(rawBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(rawBtn);

    expect(renderedBtn).toHaveAttribute("aria-pressed", "false");
    expect(rawBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Extracted raw markdown text")).toBeInTheDocument();
  });

  it("renders export format buttons and invokes onDownload", () => {
    const onDownload = vi.fn();
    render(<DocumentPreview preview={mockPreview} onDownload={onDownload} />);

    const markdownExport = screen.getByRole("button", { name: "Export as markdown" });
    expect(markdownExport).toBeInTheDocument();

    fireEvent.click(markdownExport);
    expect(onDownload).toHaveBeenCalledWith("markdown");
  });

  it("disables export buttons while export is in progress", () => {
    render(<DocumentPreview preview={mockPreview} exporting="markdown" onDownload={vi.fn()} />);

    const markdownExport = screen.getByRole("button", { name: /Export as markdown — in progress/i });
    expect(markdownExport).toBeDisabled();

    const jsonExport = screen.getByRole("button", { name: "Export as json" });
    expect(jsonExport).toBeDisabled();
  });

  it("renders original document tab and switches to original panel", () => {
    const onDownload = vi.fn();
    render(
      <DocumentPreview
        preview={mockPreview}
        rawBlobUrl="blob:http://localhost:3000/mock-pdf"
        onDownload={onDownload}
      />
    );

    const originalTab = screen.getByRole("tab", { name: "Original Document" });
    expect(originalTab).toBeInTheDocument();
    expect(originalTab).toHaveAttribute("id", "tab-original");
    expect(originalTab).toHaveAttribute("aria-controls", "panel-original");

    fireEvent.click(originalTab);
    expect(originalTab).toHaveAttribute("aria-selected", "true");

    const originalPanel = screen.getByRole("tabpanel");
    expect(originalPanel).toHaveAttribute("id", "panel-original");

    // Iframe rendered for PDF
    const iframe = screen.getByTitle(/Original PDF document: Annual_Report_2026\.pdf/i);
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", "blob:http://localhost:3000/mock-pdf");

    // Download original button inside toolbar
    const downloadOriginalBtn = screen.getByRole("button", { name: "Download original file" });
    fireEvent.click(downloadOriginalBtn);
    expect(onDownload).toHaveBeenCalledWith("original");
  });

  it("renders office file fallback notice for .docx files", () => {
    const officePreview: DocumentPreviewType = {
      ...mockPreview,
      original_name: "Proposal.docx",
    };
    render(
      <DocumentPreview
        preview={officePreview}
        rawBlobUrl="blob:http://localhost:3000/mock-docx"
        onDownload={vi.fn()}
      />
    );

    const originalTab = screen.getByRole("tab", { name: "Original Document" });
    fireEvent.click(originalTab);

    expect(screen.getByText("Office Document Preview")).toBeInTheDocument();
    expect(screen.getByText(/Binary Office documents \(DOCX\) cannot be rendered directly/i)).toBeInTheDocument();
  });
});
