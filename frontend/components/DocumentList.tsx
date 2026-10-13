"use client";

import { StatusBadge } from "@/components/StatusBadge";
import type { DocumentSummary } from "@/lib/types";

interface DocumentListProps {
  documents: DocumentSummary[];
  loading: boolean;
  selectedDocumentId?: string;
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
  onRetry?: (id: string) => void;
}

export function DocumentList({
  documents,
  loading,
  selectedDocumentId,
  onPreview,
  onDelete,
  onRetry,
}: Readonly<DocumentListProps>) {
  if (loading) {
    return <p className="muted">Loading your documents…</p>;
  }

  if (documents.length === 0) {
    return <p className="muted">No documents uploaded yet. Upload a file above to begin.</p>;
  }

  return (
    <ul className="document-list" aria-label="Uploaded documents">
      {documents.map((doc) => {
        const isSelected = selectedDocumentId === doc.id;
        const isReady = doc.status === "ready";
        const isFailed = doc.status === "failed";

        return (
          <li
            key={doc.id}
            style={isSelected ? { borderColor: "var(--accent)" } : undefined}
          >
            <span>
              <strong>{doc.original_name}</strong>
              <StatusBadge
                status={doc.status}
                stage={doc.processing_stage}
                progress={doc.processing_progress}
              />
            </span>
            <span className="document-actions">
              <button
                className="link-button"
                type="button"
                disabled={!isReady}
                onClick={() => onPreview(doc.id)}
              >
                {isSelected ? "Viewing" : "Preview"}
              </button>
              {isFailed && onRetry && (
                <button
                  className="link-button"
                  type="button"
                  onClick={() => onRetry(doc.id)}
                  style={{ color: "#fde68a" }}
                >
                  Retry
                </button>
              )}
              <button
                className="link-button"
                type="button"
                onClick={() => onDelete(doc.id)}
              >
                Delete
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
