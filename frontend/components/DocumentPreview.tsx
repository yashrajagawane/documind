"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocumentPreview as DocumentPreviewType } from "@/lib/types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { apiDownload } from "@/lib/api";

export type PreviewTab = "markdown" | "tables" | "original";

interface DocumentPreviewProps {
  preview: DocumentPreviewType;
  highlightSection?: string | null;
  /** The format currently being exported (e.g. "markdown"), or null when idle. */
  exporting?: string | null;
  accessToken?: string | null;
  rawBlobUrl?: string | null;
  onDownload: (format: string) => void;
}

export function DocumentPreview({
  preview,
  highlightSection = null,
  exporting = null,
  accessToken = null,
  rawBlobUrl = null,
  onDownload,
}: Readonly<DocumentPreviewProps>) {
  const [activeTab, setActiveTab] = useState<PreviewTab>("markdown");
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [copiedTableIndex, setCopiedTableIndex] = useState<number | null>(null);

  // Original file state
  const [fetchedBlobUrl, setFetchedBlobUrl] = useState<string | null>(null);
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);
  const [prevDocId, setPrevDocId] = useState(preview.id);

  // Synchronize state during render when switching documents
  if (preview.id !== prevDocId) {
    setPrevDocId(preview.id);
    setActiveTab("markdown");
    setLoadingRaw(false);
    setRawError(null);
  }

  const effectiveRawUrl = rawBlobUrl || fetchedBlobUrl;

  const tables = preview.tables ?? [];
  const wordCount = preview.metadata?.word_count ?? 0;
  const charCount = preview.metadata?.character_count ?? 0;

  const ext = preview.original_name.split(".").pop()?.toLowerCase() ?? "";
  const isPdf = ext === "pdf";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isOffice = ["docx", "pptx", "xlsx"].includes(ext);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (fetchedBlobUrl) {
        URL.revokeObjectURL(fetchedBlobUrl);
      }
    };
  }, [fetchedBlobUrl]);

  const loadOriginalFile = useCallback(async () => {
    if (effectiveRawUrl || loadingRaw) return;
    if (!accessToken) {
      setRawError("Authentication token is required to load the original file.");
      return;
    }
    setLoadingRaw(true);
    setRawError(null);
    try {
      const blob = await apiDownload(`/documents/${preview.id}/raw`, accessToken);
      const url = URL.createObjectURL(blob);
      setFetchedBlobUrl(url);
    } catch (err) {
      setRawError(err instanceof Error ? err.message : "Failed to load original document.");
    } finally {
      setLoadingRaw(false);
    }
  }, [effectiveRawUrl, loadingRaw, accessToken, preview.id]);

  const handleSelectTab = (tab: PreviewTab) => {
    setActiveTab(tab);
    if (tab === "original" && !effectiveRawUrl && !loadingRaw) {
      void loadOriginalFile();
    }
  };

  const handleCopyTable = (index: number, markdown: string) => {
    void navigator.clipboard.writeText(markdown);
    setCopiedTableIndex(index);
    setTimeout(() => setCopiedTableIndex(null), 2000);
  };

  const availableTabs: PreviewTab[] = [
    "markdown",
    ...(tables.length > 0 ? (["tables"] as const) : []),
    "original",
  ];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: PreviewTab
  ) => {
    if (availableTabs.length <= 1) return;
    const currentIndex = availableTabs.indexOf(currentTab);
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % availableTabs.length;
      const nextTab = availableTabs[nextIndex];
      handleSelectTab(nextTab);
      setTimeout(() => {
        document.getElementById(`tab-${nextTab}`)?.focus();
      }, 0);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
      const prevTab = availableTabs[prevIndex];
      handleSelectTab(prevTab);
      setTimeout(() => {
        document.getElementById(`tab-${prevTab}`)?.focus();
      }, 0);
    }
  };

  return (
    <div aria-label={`Document preview: ${preview.original_name}`}>
      <div className="preview-header">
        <h2 id="preview-heading">{preview.original_name}</h2>
        <span>
          {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars
          {tables.length > 0 ? ` · ${tables.length} table${tables.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0.5rem 0", flexWrap: "wrap", gap: "0.5rem" }}>
        <div className="preview-tabs" role="tablist" aria-label="Document view tabs" style={{ margin: 0, borderBottom: 0, paddingBottom: 0 }}>
          <button
            id="tab-markdown"
            className={`tab-button ${activeTab === "markdown" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "markdown"}
            aria-controls="panel-markdown"
            tabIndex={activeTab === "markdown" ? 0 : -1}
            onClick={() => handleSelectTab("markdown")}
            onKeyDown={(e) => handleTabKeyDown(e, "markdown")}
          >
            Markdown Content
          </button>
          {tables.length > 0 && (
            <button
              id="tab-tables"
              className={`tab-button ${activeTab === "tables" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === "tables"}
              aria-controls="panel-tables"
              tabIndex={activeTab === "tables" ? 0 : -1}
              onClick={() => handleSelectTab("tables")}
              onKeyDown={(e) => handleTabKeyDown(e, "tables")}
            >
              Extracted Tables ({tables.length})
            </button>
          )}
          <button
            id="tab-original"
            className={`tab-button ${activeTab === "original" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "original"}
            aria-controls="panel-original"
            tabIndex={activeTab === "original" ? 0 : -1}
            onClick={() => handleSelectTab("original")}
            onKeyDown={(e) => handleTabKeyDown(e, "original")}
          >
            Original Document
          </button>
        </div>

        {activeTab === "markdown" && (
          <div role="group" aria-label="Markdown view mode" style={{ display: "flex", gap: "0.35rem" }}>
            <button
              type="button"
              className={`tab-button ${viewMode === "rendered" ? "active" : ""}`}
              aria-pressed={viewMode === "rendered"}
              onClick={() => setViewMode("rendered")}
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.55rem" }}
            >
              Rendered
            </button>
            <button
              type="button"
              className={`tab-button ${viewMode === "raw" ? "active" : ""}`}
              aria-pressed={viewMode === "raw"}
              onClick={() => setViewMode("raw")}
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.55rem" }}
            >
              Raw Source
            </button>
          </div>
        )}
      </div>

      {activeTab === "markdown" && (
        <div
          role="tabpanel"
          id="panel-markdown"
          aria-labelledby="tab-markdown"
          tabIndex={0}
        >
          {viewMode === "rendered" ? (
            <div style={{ maxHeight: "28rem", overflowY: "auto", padding: "0.5rem 0.75rem", background: "var(--surface)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
              <MarkdownRenderer
                content={preview.markdown}
                highlightSection={highlightSection}
              />
            </div>
          ) : (
            <pre tabIndex={0} role="region" aria-label="Extracted raw markdown text" style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "0.5rem" }}>
              {preview.markdown}
            </pre>
          )}
        </div>
      )}

      {activeTab === "tables" && (
        <div
          role="tabpanel"
          id="panel-tables"
          aria-labelledby="tab-tables"
          tabIndex={0}
          className="table-wrapper"
        >
          {tables.map((table, index) => {
            const markdownTable = typeof table.markdown === "string" ? table.markdown : "";
            const rows = Array.isArray(table.rows) ? (table.rows as Record<string, unknown>[]) : [];
            const columns = Array.isArray(table.columns) ? (table.columns as string[]) : [];

            return (
              <div key={index} style={{ marginBottom: "1.5rem", background: "var(--surface)", padding: "0.75rem", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9rem" }}>Table {index + 1}</p>
                  {markdownTable && (
                    <button
                      type="button"
                      className="copy-button"
                      onClick={() => handleCopyTable(index, markdownTable)}
                    >
                      {copiedTableIndex === index ? "✓ Copied" : "Copy Markdown"}
                    </button>
                  )}
                </div>
                {columns.length > 0 && rows.length > 0 ? (
                  <table className="table-viewer">
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {columns.map((col) => (
                            <td key={col}>{String(row[col] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <pre>{markdownTable || JSON.stringify(table, null, 2)}</pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "original" && (
        <div
          role="tabpanel"
          id="panel-original"
          aria-labelledby="tab-original"
          tabIndex={0}
          className="original-viewer-container"
        >
          <div className="original-viewer-toolbar">
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
              {preview.original_name}
            </span>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {effectiveRawUrl && (
                <a
                  href={effectiveRawUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-button"
                  style={{ fontSize: "0.8rem", textDecoration: "none" }}
                  aria-label="Open original file in new browser tab"
                >
                  Open in new tab ↗
                </a>
              )}
              <button
                type="button"
                className="copy-button"
                onClick={() => onDownload("original")}
                disabled={exporting !== null}
                aria-label="Download original file"
              >
                Download Original
              </button>
            </div>
          </div>

          {loadingRaw && (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
              Loading original document…
            </div>
          )}

          {rawError && (
            <div className="workspace-alert" role="alert" style={{ margin: "1rem 0" }}>
              <span>⚠</span>
              <span>{rawError}</span>
            </div>
          )}

          {!loadingRaw && !rawError && (
            <>
              {isPdf && effectiveRawUrl && (
                <iframe
                  src={effectiveRawUrl}
                  title={`Original PDF document: ${preview.original_name}`}
                  className="original-file-frame"
                />
              )}

              {isImage && effectiveRawUrl && (
                <div style={{ display: "flex", justifyContent: "center", padding: "1rem" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={effectiveRawUrl}
                    alt={`Original upload: ${preview.original_name}`}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "580px",
                      borderRadius: "0.375rem",
                      border: "1px solid var(--border)",
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}

              {isOffice && (
                <div className="original-fallback-card">
                  <div style={{ fontSize: "2.5rem" }}>📄</div>
                  <div>
                    <p style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                      Office Document Preview
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: "28rem" }}>
                      Binary Office documents ({ext.toUpperCase()}) cannot be rendered directly inside the browser.
                      You can download the original file or inspect the extracted markdown and tables.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => onDownload("original")}
                    style={{ marginTop: "0.5rem" }}
                  >
                    Download {preview.original_name}
                  </button>
                </div>
              )}

              {!isPdf && !isImage && !isOffice && effectiveRawUrl && (
                <iframe
                  src={effectiveRawUrl}
                  title={`Original document: ${preview.original_name}`}
                  className="original-file-frame"
                />
              )}
            </>
          )}
        </div>
      )}

      <div className="export-actions" role="group" aria-label="Export document formats" style={{ marginTop: "1rem" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {exporting ? "Exporting…" : "Export:"}
        </span>
        {(["markdown", "json", "html", "txt", "original"] as const).map((fmt) => (
          <button
            key={fmt}
            className="link-button"
            type="button"
            disabled={exporting !== null}
            aria-label={`Export as ${fmt}${exporting === fmt ? " — in progress" : ""}`}
            onClick={() => onDownload(fmt)}
            style={exporting === fmt ? { opacity: 0.5, cursor: "wait" } : undefined}
          >
            {fmt.charAt(0).toUpperCase() + fmt.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
