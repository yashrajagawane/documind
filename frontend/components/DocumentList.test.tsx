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
  expect(screen.getByText(/Loading documents/i)).toBeInTheDocument();
});

test("renders engaging empty state with direct upload call-to-action", () => {
  // Create dummy file input in DOM to test click dispatch
  const fileInput = document.createElement("input");
  fileInput.id = "file-upload-input";
  fileInput.type = "file";
  const clickSpy = vi.spyOn(fileInput, "click");
  document.body.appendChild(fileInput);

  render(
    <DocumentList
      documents={[]}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  expect(screen.getByText(/No documents yet/i)).toBeInTheDocument();
  expect(screen.getByText(/Drop a file into the upload zone/i)).toBeInTheDocument();

  const uploadBtn = screen.getByRole("button", { name: /Upload your first document/i });
  expect(uploadBtn).toBeInTheDocument();

  fireEvent.click(uploadBtn);
  expect(clickSpy).toHaveBeenCalled();

  document.body.removeChild(fileInput);
});

test("renders document items with clickable name buttons", () => {
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

  // The name itself IS the preview button now — ready docs are enabled
  const contractBtn = screen.getByRole("button", { name: "contract.pdf" });
  expect(contractBtn).toBeEnabled();

  // Non-ready docs have the name button disabled
  const xlsxBtn = screen.getByRole("button", { name: "data.xlsx" });
  expect(xlsxBtn).toBeDisabled();
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

  // Delete buttons now have aria-label "Delete <name>"
  const deleteButton = screen.getByRole("button", { name: "Delete contract.pdf" });
  fireEvent.click(deleteButton);

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

  const deleteButton = screen.getByRole("button", { name: "Delete contract.pdf" });
  fireEvent.click(deleteButton);

  const cancelButton = await screen.findByRole("button", { name: /cancel/i });
  fireEvent.click(cancelButton);

  expect(onDelete).not.toHaveBeenCalled();
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

  const deleteButton = screen.getByRole("button", { name: "Delete contract.pdf" });
  fireEvent.click(deleteButton);

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

  const deleteButton = screen.getByRole("button", { name: "Delete contract.pdf" });
  fireEvent.click(deleteButton);

  const confirmButton = await screen.findByRole("button", { name: /delete document/i });
  fireEvent.click(confirmButton);

  expect(onDelete).toHaveBeenCalledOnce();
  expect(onDelete).toHaveBeenCalledWith("doc-1");
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});

test("shows disabled delete button when deletingId matches", () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      deletingId="doc-1"
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  // Compact mode shows "…" as the button text; it should be disabled
  const deletingButton = screen.getByRole("button", { name: "Delete contract.pdf" });
  expect(deletingButton).toBeDisabled();
});

// ── Search & Filter Tests ─────────────────────────────────────────────────

test("filters documents by search query", () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const searchInput = screen.getByRole("searchbox", { name: /search documents/i });
  fireEvent.change(searchInput, { target: { value: "contract" } });

  expect(screen.getByText("contract.pdf")).toBeInTheDocument();
  expect(screen.queryByText("data.xlsx")).not.toBeInTheDocument();

  // Clear button appears
  const clearBtn = screen.getByRole("button", { name: /clear search query/i });
  fireEvent.click(clearBtn);

  expect(screen.getByText("contract.pdf")).toBeInTheDocument();
  expect(screen.getByText("data.xlsx")).toBeInTheDocument();
});

test("filters documents by status pills", () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  // Click "Ready" pill
  const readyPill = screen.getByRole("button", { name: /Ready/i });
  fireEvent.click(readyPill);

  expect(screen.getByText("contract.pdf")).toBeInTheDocument();
  expect(screen.queryByText("data.xlsx")).not.toBeInTheDocument();

  // Click "Processing" pill
  const processingPill = screen.getByRole("button", { name: /Processing/i });
  fireEvent.click(processingPill);

  expect(screen.queryByText("contract.pdf")).not.toBeInTheDocument();
  expect(screen.getByText("data.xlsx")).toBeInTheDocument();

  // Click "All" pill
  const allPill = screen.getByRole("button", { name: /All/i });
  fireEvent.click(allPill);

  expect(screen.getByText("contract.pdf")).toBeInTheDocument();
  expect(screen.getByText("data.xlsx")).toBeInTheDocument();
});

test("shows empty filter state and resets when no documents match", () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const searchInput = screen.getByRole("searchbox", { name: /search documents/i });
  fireEvent.change(searchInput, { target: { value: "nonexistent-doc-name" } });

  expect(screen.getByText(/No documents match your filter/i)).toBeInTheDocument();
  expect(screen.queryByText("contract.pdf")).not.toBeInTheDocument();

  const resetBtn = screen.getByRole("button", { name: /reset filters/i });
  fireEvent.click(resetBtn);

  expect(screen.getByText("contract.pdf")).toBeInTheDocument();
  expect(screen.getByText("data.xlsx")).toBeInTheDocument();
});

test("pressing '/' focuses the search input", () => {
  render(
    <DocumentList
      documents={mockDocuments}
      loading={false}
      onPreview={vi.fn()}
      onDelete={vi.fn()}
    />
  );

  const searchInput = screen.getByRole("searchbox", { name: /search documents/i });
  expect(document.activeElement).not.toBe(searchInput);

  fireEvent.keyDown(window, { key: "/" });
  expect(document.activeElement).toBe(searchInput);
});

