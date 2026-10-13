import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

import { DocumentList } from "./DocumentList";
import type { DocumentSummary } from "@/lib/types";

const mockDocuments: DocumentSummary[] = [
  {
    id: "doc-1",
    original_name: "contract.pdf",
    checksum_sha256: "abc123hash",
    status: "ready",
    processing_stage: "completed",
    processing_progress: 100,
    created_at: new Date().toISOString(),
  },
  {
    id: "doc-2",
    original_name: "data.xlsx",
    checksum_sha256: "def456hash",
    status: "queued",
    processing_stage: "queued",
    processing_progress: 0,
    created_at: new Date().toISOString(),
  },
];

test("renders loading state", () => {
  render(
    <DocumentList
      documents={[]}
      loading={true}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );
  expect(screen.getByText("Loading your documents…")).toBeInTheDocument();
});

test("renders empty state", () => {
  render(
    <DocumentList
      documents={[]}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );
  expect(screen.getByText(/No documents uploaded yet/i)).toBeInTheDocument();
});

test("renders document items with action buttons", () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );
  expect(screen.getByText("contract.pdf")).toBeInTheDocument();
  expect(screen.getByText("data.xlsx")).toBeInTheDocument();

  const previewButtons = screen.getAllByRole("button", { name: "Preview" });
  expect(previewButtons).toHaveLength(2);
  expect(previewButtons[0]).toBeEnabled();
  expect(previewButtons[1]).toBeDisabled();
});
