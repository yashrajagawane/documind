"use client";

import { useState, useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  disabled?: boolean;
}

export interface UploadQueueItem {
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".csv", ".md"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onUpload, disabled = false }: Readonly<UploadZoneProps>) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[]) => {
    if (files.length === 0 || disabled) return;
    setGeneralError(null);

    const validFiles: { file: File; item: UploadQueueItem }[] = [];
    const newItems: UploadQueueItem[] = [];

    for (const file of files) {
      const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
      const isAllowed = ALLOWED_EXTENSIONS.includes(extension);
      const isWithinSize = file.size <= MAX_UPLOAD_BYTES;

      const item: UploadQueueItem = {
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        status: !isAllowed || !isWithinSize ? "error" : "pending",
        error: !isAllowed
          ? "Unsupported format. Use PDF, DOCX, XLSX, PPTX, TXT, CSV, or MD."
          : !isWithinSize
          ? `File exceeds 25MB (${formatBytes(file.size)}).`
          : undefined,
      };

      newItems.push(item);
      if (isAllowed && isWithinSize) {
        validFiles.push({ file, item });
      }
    }

    setQueue((prev) => [...newItems, ...prev]);

    // Process valid files sequentially or with bounded concurrency
    for (const { file, item } of validFiles) {
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: "uploading" } : q))
      );

      try {
        await onUpload(file);
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: "success" } : q))
        );
      } catch (err) {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "error",
                  error: err instanceof Error ? err.message : "Upload failed.",
                }
              : q
          )
        );
      }
    }
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    const droppedFiles = Array.from(event.dataTransfer.files);
    await processFiles(droppedFiles);
  };

  const handleInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const selectedFiles = Array.from(event.target.files);
    await processFiles(selectedFiles);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status !== "success"));
  };

  const hasCompleted = queue.some((item) => item.status === "success");

  return (
    <section aria-labelledby="upload-heading" style={{ marginBottom: "1rem" }}>
      <h2 id="upload-heading" style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
        Document Ingestion
      </h2>

      <div
        className={`upload-dropzone ${isDragOver ? "drag-active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload files by dragging and dropping or clicking"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.md"
          disabled={disabled}
          style={{ display: "none" }}
          onChange={handleInputChange}
          aria-hidden="true"
        />

        <div style={{ pointerEvents: "none" }}>
          <p style={{ margin: "0 0 0.25rem", fontWeight: 600, fontSize: "0.92rem" }}>
            {isDragOver ? "Drop files to upload instantly" : "Drag & drop files here, or click to browse"}
          </p>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.8rem" }}>
            Supports PDF, DOCX, XLSX, PPTX, TXT, CSV, MD up to 25MB each (batch upload enabled)
          </p>
        </div>
      </div>

      {generalError && (
        <p className="form-error" role="alert" style={{ marginTop: "0.5rem" }}>
          {generalError}
        </p>
      )}

      {queue.length > 0 && (
        <div className="upload-queue" aria-label="Upload queue" style={{ marginTop: "0.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              Upload Activity ({queue.length})
            </span>
            {hasCompleted && (
              <button
                type="button"
                className="link-button"
                onClick={handleClearCompleted}
                style={{ fontSize: "0.75rem", margin: 0 }}
              >
                Clear completed
              </button>
            )}
          </div>

          <ul style={{ listStyle: "none", margin: "0.35rem 0 0", padding: 0, display: "grid", gap: "0.35rem" }}>
            {queue.map((item) => (
              <li
                key={item.id}
                className="upload-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.45rem 0.75rem",
                  background: "var(--surface)",
                  borderRadius: "0.4rem",
                  border: "1px solid var(--border)",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <strong>{item.name}</strong>{" "}
                  <small style={{ color: "var(--text-secondary)" }}>({formatBytes(item.size)})</small>
                  {item.error && (
                    <div style={{ color: "#fca5a5", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                      {item.error}
                    </div>
                  )}
                </div>

                <div style={{ marginLeft: "0.75rem", flexShrink: 0 }}>
                  {item.status === "pending" && (
                    <span style={{ color: "var(--text-secondary)" }}>Queued</span>
                  )}
                  {item.status === "uploading" && (
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>Uploading…</span>
                  )}
                  {item.status === "success" && (
                    <span style={{ color: "#10b981", fontWeight: 600 }}>✓ Uploaded</span>
                  )}
                  {item.status === "error" && (
                    <span style={{ color: "#ef4444", fontWeight: 600 }}>Failed</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
