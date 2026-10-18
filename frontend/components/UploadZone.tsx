"use client";

import { useState, useRef } from "react";
import type { ChangeEvent, DragEvent } from "react";

import type { UploadProgress } from "@/lib/api";

interface UploadZoneProps {
  onUpload: (
    file: File,
    onProgress?: (progress: UploadProgress) => void
  ) => Promise<void>;
  disabled?: boolean;
  /** Compact mode for sidebar: smaller padding and abbreviated text. */
  compact?: boolean;
}

export interface UploadQueueItem {
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  progressPercent?: number;
  loadedBytes?: number;
  totalBytes?: number;
  error?: string;
}

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".csv", ".md"];
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadZone({ onUpload, disabled = false, compact = false }: Readonly<UploadZoneProps>) {
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
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: "uploading",
                progressPercent: 0,
                loadedBytes: 0,
                totalBytes: file.size,
              }
            : q
        )
      );

      try {
        await onUpload(file, (progress) => {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    progressPercent: progress.percent,
                    loadedBytes: progress.loaded,
                    totalBytes: progress.total > 0 ? progress.total : file.size,
                  }
                : q
            )
          );
        });

        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  status: "success",
                  progressPercent: 100,
                  loadedBytes: file.size,
                  totalBytes: file.size,
                }
              : q
          )
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
    <section aria-labelledby="upload-heading" style={{ marginBottom: compact ? "0" : "1rem" }}>
      {!compact && (
        <h2 id="upload-heading" style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>
          Document Ingestion
        </h2>
      )}

      <div
        className={`upload-dropzone ${isDragOver ? "drag-active" : ""}${disabled ? " disabled" : ""}`}
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
          id="file-upload-input"
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.md"
          disabled={disabled}
          className="sr-only"
          onChange={handleInputChange}
          tabIndex={-1}
          aria-label="File upload"
        />

        <label
          htmlFor="file-upload-input"
          style={{ pointerEvents: "none", cursor: disabled ? "not-allowed" : "pointer" }}
        >
          <p style={{ margin: "0 0 0.2rem", fontWeight: 600, fontSize: compact ? "0.8rem" : "0.92rem" }}>
            {isDragOver
              ? "Drop to upload"
              : compact
              ? "Drop files or click to browse"
              : "Drag & drop files here, or click to browse"}
          </p>
          {!compact && (
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.8rem" }}>
              Supports PDF, DOCX, XLSX, PPTX, TXT, CSV, MD up to 25MB each (batch upload enabled)
            </p>
          )}
          {compact && (
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.72rem" }}>
              PDF, DOCX, XLSX, PPTX, TXT, CSV, MD · 25MB max
            </p>
          )}
        </label>
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
                  flexDirection: "column",
                  padding: "0.45rem 0.75rem",
                  background: "var(--surface)",
                  borderRadius: "0.4rem",
                  border: "1px solid var(--border)",
                  fontSize: "0.82rem",
                  gap: "0.25rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                  }}
                >
                  <div
                    style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={item.name}
                  >
                    <strong style={{ wordBreak: "break-all" }}>{item.name}</strong>{" "}
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
                      <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                        {item.progressPercent !== undefined ? `${item.progressPercent}%` : "Uploading…"}
                      </span>
                    )}
                    {item.status === "success" && (
                      <span style={{ color: "#10b981", fontWeight: 600 }}>✓ Uploaded</span>
                    )}
                    {item.status === "error" && (
                      <span style={{ color: "#ef4444", fontWeight: 600 }}>Failed</span>
                    )}
                  </div>
                </div>

                {item.status === "uploading" && (
                  <div style={{ width: "100%", marginTop: "0.15rem" }}>
                    <div
                      role="progressbar"
                      aria-valuenow={item.progressPercent ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Upload progress for ${item.name}`}
                      style={{
                        width: "100%",
                        height: "4px",
                        background: "rgba(255, 255, 255, 0.08)",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${item.progressPercent ?? 0}%`,
                          height: "100%",
                          background: "var(--accent, #7c3aed)",
                          transition: "width 0.15s ease-out",
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.72rem",
                        color: "var(--text-secondary)",
                        marginTop: "0.2rem",
                      }}
                    >
                      <span>
                        {formatBytes(item.loadedBytes ?? 0)} / {formatBytes(item.totalBytes ?? item.size)}
                      </span>
                      <span>Uploading…</span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
