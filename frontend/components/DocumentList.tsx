"use client";

import { useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";
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

  const requestDelete = (doc: DocumentSummary) => setPendingDeleteDoc(doc);

  const confirmDelete = () => {
    if (pendingDeleteDoc) onDelete(pendingDeleteDoc.id);
    setPendingDeleteDoc(null);
  };

  const cancelDelete = () => setPendingDeleteDoc(null);

  if (loading) {
    return (
      <p className="muted" style={{ padding: "0.75rem", fontSize: "0.82rem" }}>
        Loading documents…
      </p>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="muted" style={{ padding: "0.75rem", fontSize: "0.82rem" }}>
        No documents yet. Drop a file above.
      </p>
    );
  }

  return (
    <>
      {pendingDeleteDoc && (
        <ConfirmDeleteDialog
          targetDoc={pendingDeleteDoc}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      <ul className="document-list" aria-label="Uploaded documents">
        {documents.map((doc) => {
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
    </>
  );
}
