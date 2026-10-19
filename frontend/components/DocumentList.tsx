"use client";

import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentListSkeleton } from "@/components/Skeleton";
import type { DocumentSummary } from "@/lib/types";

interface DocumentListProps {
  documents: DocumentSummary[];
  loading: boolean;
  selectedDocumentId?: string;
  deletingId?: string | null;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

interface ConfirmDeleteDialogProps {
  targetDoc: DocumentSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Accessible confirmation dialog — traps focus and closes on Escape. */
function ConfirmDeleteDialog({ targetDoc, onConfirm, onCancel }: Readonly<ConfirmDeleteDialogProps>) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Auto-focus the Cancel button (safe default) when dialog opens
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Trap focus inside dialog and handle Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="confirm-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">
          Delete document?
        </h2>
        <p id="confirm-dialog-desc" className="confirm-dialog-desc">
          <strong>&ldquo;{targetDoc.original_name}&rdquo;</strong> will be permanently removed along
          with its extracted tables and indexed vectors.{" "}
          <span className="confirm-dialog-warning">This action cannot be undone.</span>
        </p>
        <div className="confirm-dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="button confirm-cancel-button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button confirm-delete-button"
            onClick={onConfirm}
          >
            Delete document
          </button>
        </div>
      </div>
    </div>
  );
}

export function DocumentList({
  documents,
  loading,
  selectedDocumentId,
  deletingId,
  onPreview,
  onDelete,
  onRetry,
}: Readonly<DocumentListProps>) {
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<DocumentSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ready" | "processing" | "failed">("all");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: '/' focuses the search input when not typing in form controls
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((event.target as HTMLElement)?.tagName)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const requestDelete = (doc: DocumentSummary) => setPendingDeleteDoc(doc);

  const confirmDelete = () => {
    if (pendingDeleteDoc) onDelete(pendingDeleteDoc.id);
    setPendingDeleteDoc(null);
  };

  const cancelDelete = () => setPendingDeleteDoc(null);

  if (loading) {
    return <DocumentListSkeleton count={3} />;
  }

  if (documents.length === 0) {
    return (
      <div className="doc-list-empty-state">
        <div className="doc-list-empty-icon" aria-hidden="true">
          📄
        </div>
        <p className="doc-list-empty-title">No documents yet</p>
        <p className="doc-list-empty-desc">
          Drop a file into the upload zone above or browse files to begin.
        </p>
        <button
          type="button"
          className="link-button doc-list-empty-btn"
          onClick={() => {
            const input = document.getElementById("file-upload-input");
            input?.click();
          }}
          aria-label="Upload your first document"
        >
          + Upload your first document
        </button>
      </div>
    );
  }

  // Filter calculations
  const counts = {
    all: documents.length,
    ready: documents.filter((d) => d.status === "ready").length,
    processing: documents.filter((d) => d.status !== "ready" && d.status !== "failed").length,
    failed: documents.filter((d) => d.status === "failed").length,
  };

  const filteredDocuments = documents.filter((doc) => {
    if (statusFilter === "ready" && doc.status !== "ready") return false;
    if (statusFilter === "processing" && (doc.status === "ready" || doc.status === "failed")) return false;
    if (statusFilter === "failed" && doc.status !== "failed") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return doc.original_name.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <>
      {pendingDeleteDoc && (
        <ConfirmDeleteDialog
          targetDoc={pendingDeleteDoc}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {/* ── Document Search and Filter Bar ────────────────── */}
      <div className="doc-search-container" role="search" aria-label="Filter documents">
        <div className="doc-search-input-wrapper">
          <span className="doc-search-icon" aria-hidden="true">
            🔍
          </span>
          <input
            ref={searchInputRef}
            type="search"
            className="doc-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                searchInputRef.current?.blur();
              }
            }}
            placeholder="Search documents… ('/' to focus)"
            aria-label="Search documents by name"
          />
          {searchQuery && (
            <button
              type="button"
              className="doc-search-clear-btn"
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}
        </div>

        <div className="doc-filter-pills" role="group" aria-label="Filter documents by status">
          <button
            type="button"
            className={`doc-filter-pill ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
            aria-pressed={statusFilter === "all"}
          >
            All ({counts.all})
          </button>
          {counts.ready > 0 && (
            <button
              type="button"
              className={`doc-filter-pill ${statusFilter === "ready" ? "active" : ""}`}
              onClick={() => setStatusFilter("ready")}
              aria-pressed={statusFilter === "ready"}
            >
              Ready ({counts.ready})
            </button>
          )}
          {counts.processing > 0 && (
            <button
              type="button"
              className={`doc-filter-pill ${statusFilter === "processing" ? "active" : ""}`}
              onClick={() => setStatusFilter("processing")}
              aria-pressed={statusFilter === "processing"}
            >
              Processing ({counts.processing})
            </button>
          )}
          {counts.failed > 0 && (
            <button
              type="button"
              className={`doc-filter-pill ${statusFilter === "failed" ? "active" : ""}`}
              onClick={() => setStatusFilter("failed")}
              aria-pressed={statusFilter === "failed"}
            >
              Failed ({counts.failed})
            </button>
          )}
        </div>
      </div>

      {filteredDocuments.length === 0 ? (
        <div className="doc-filter-empty">
          <p className="doc-filter-empty-text">No documents match your filter.</p>
          <button
            type="button"
            className="link-button doc-filter-reset-btn"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <ul className="document-list" aria-label="Uploaded documents">
          {filteredDocuments.map((doc) => {
            const isSelected = selectedDocumentId === doc.id;
            const isReady = doc.status === "ready";
            const isFailed = doc.status === "failed";
            const isDeleting = deletingId === doc.id;

            return (
              <li
                key={doc.id}
                className={isSelected ? "selected" : ""}
                aria-busy={isDeleting}
                aria-current={isSelected ? "true" : undefined}
              >
                {/* Document name — clicking the row previews it */}
                <button
                  type="button"
                  className="doc-item-name"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: isReady ? "pointer" : "default",
                    textAlign: "left",
                    padding: 0,
                    color: isReady ? "var(--text-primary)" : "var(--text-secondary)",
                    width: "100%",
                  }}
                  disabled={!isReady}
                  onClick={() => isReady && onPreview(doc.id)}
                  title={doc.original_name}
                >
                  {doc.original_name}
                </button>

                {/* Status chip + action buttons on the same row */}
                <div className="doc-item-row">
                  <StatusBadge
                    status={doc.status}
                    stage={doc.processing_stage}
                    progress={doc.processing_progress}
                  />
                  <span className="document-actions">
                    {isFailed && onRetry && (
                      <button
                        className="link-button"
                        type="button"
                        onClick={() => onRetry(doc.id)}
                        style={{ color: "#fde68a" }}
                        aria-label={`Retry processing ${doc.original_name}`}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      className="link-button danger"
                      type="button"
                      disabled={isDeleting}
                      aria-label={`Delete ${doc.original_name}`}
                      onClick={() => requestDelete(doc)}
                    >
                      {isDeleting ? "…" : "Del"}
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
