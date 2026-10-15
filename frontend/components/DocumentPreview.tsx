"use client";

import { useState } from "react";
import type { DocumentPreview as DocumentPreviewType } from "@/lib/types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface DocumentPreviewProps {
  preview: DocumentPreviewType;
  highlightSection?: string | null;
  /** The format currently being exported (e.g. "markdown"), or null when idle. */
  exporting?: string | null;
  onDownload: (format: string) => void;
}

export function DocumentPreview({
  preview,
  highlightSection = null,
  exporting = null,
  onDownload,
}: Readonly<DocumentPreviewProps>) {
  const [activeTab, setActiveTab] = useState<"markdown" | "tables">("markdown");
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [copiedTableIndex, setCopiedTableIndex] = useState<number | null>(null);

  const tables = preview.tables ?? [];
  const wordCount = preview.metadata?.word_count ?? 0;
  const charCount = preview.metadata?.character_count ?? 0;

  const handleCopyTable = (index: number, markdown: string) => {
    void navigator.clipboard.writeText(markdown);
    setCopiedTableIndex(index);
    setTimeout(() => setCopiedTableIndex(null), 2000);
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
        <div className="preview-tabs" role="tablist" style={{ margin: 0, borderBottom: 0, paddingBottom: 0 }}>
          <button
            className={`tab-button ${activeTab === "markdown" ? "active" : ""}`}
            type="button"
            role="tab"
            aria-selected={activeTab === "markdown"}
            onClick={() => setActiveTab("markdown")}
          >
            Markdown Content
          </button>
          {tables.length > 0 && (
            <button
              className={`tab-button ${activeTab === "tables" ? "active" : ""}`}
              type="button"
              role="tab"
              aria-selected={activeTab === "tables"}
              onClick={() => setActiveTab("tables")}
            >
              Extracted Tables ({tables.length})
            </button>
          )}
        </div>

        {activeTab === "markdown" && (
          <div style={{ display: "flex", gap: "0.35rem" }}>
            <button
              type="button"
              className={`tab-button ${viewMode === "rendered" ? "active" : ""}`}
              onClick={() => setViewMode("rendered")}
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.55rem" }}
            >
              Rendered
            </button>
            <button
              type="button"
              className={`tab-button ${viewMode === "raw" ? "active" : ""}`}
              onClick={() => setViewMode("raw")}
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.55rem" }}
            >
              Raw Source
            </button>
          </div>
        )}
      </div>

      {activeTab === "markdown" ? (
        viewMode === "rendered" ? (
          <div style={{ maxHeight: "28rem", overflowY: "auto", padding: "0.5rem 0.75rem", background: "var(--surface)", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
            <MarkdownRenderer
              content={preview.markdown}
              highlightSection={highlightSection}
            />
          </div>
        ) : (
          <pre tabIndex={0} aria-label="Extracted raw markdown text" style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "0.5rem" }}>
            {preview.markdown}
          </pre>
        )
      ) : (
        <div className="table-wrapper">
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

      <div className="export-actions" aria-label="Export document formats" style={{ marginTop: "1rem" }}>
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
          {exporting ? "Exporting…" : "Export:"}
        </span>
        {(["markdown", "json", "html", "txt"] as const).map((fmt) => (
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
