import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// ── Confirmation Dialog Tests ─────────────────────────────────────────────

test("clicking Delete opens the confirmation dialog", async () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
  // Click the first Delete button (contract.pdf)
  fireEvent.click(deleteButtons[0]);

  expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
  expect(screen.getByText(/Delete document\?/i)).toBeInTheDocument();
  // The filename appears in both the list AND the dialog — use getAllByText
  const filenameMatches = screen.getAllByText(/contract\.pdf/i);
  expect(filenameMatches.length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText(/This action cannot be undone/i)).toBeInTheDocument();
});

test("clicking Cancel in the dialog does NOT call onDelete", async () => {
  const onDelete = vi.fn();
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={onDelete}
    />
  );

  const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
  fireEvent.click(deleteButtons[0]);

  const cancelButton = await screen.findByRole("button", { name: /cancel/i });
  fireEvent.click(cancelButton);

  expect(onDelete).not.toHaveBeenCalled();
  // Dialog should be gone
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("pressing Escape closes the confirmation dialog without deleting", async () => {
  const onDelete = vi.fn();
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={onDelete}
    />
  );

  const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
  fireEvent.click(deleteButtons[0]);

  await screen.findByRole("alertdialog");
  fireEvent.keyDown(window, { key: "Escape" });

  await waitFor(() => {
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
  expect(onDelete).not.toHaveBeenCalled();
});

test("clicking 'Delete document' in dialog calls onDelete with correct id", async () => {
  const onDelete = vi.fn();
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={onDelete}
    />
  );

  const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
  fireEvent.click(deleteButtons[0]);

  const confirmButton = await screen.findByRole("button", { name: /delete document/i });
  fireEvent.click(confirmButton);

  expect(onDelete).toHaveBeenCalledOnce();
  expect(onDelete).toHaveBeenCalledWith("doc-1");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("shows 'Deleting…' and disabled button when deletingId matches", () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      deletingId="doc-1"
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  // The aria-label keeps "Delete contract.pdf" even when displaying "Deleting…"
  // Query by visible text content instead
  const deletingButton = screen.getByText("Deleting…");
  expect(deletingButton.closest("button")).toBeDisabled();
});
