"use client";

import { useState } from "react";
import type { DocumentPreview as DocumentPreviewType } from "@/lib/types";

interface DocumentPreviewProps {
  preview: DocumentPreviewType;
  onDownload: (format: string) => void;
}

export function DocumentPreview({ preview, onDownload }: Readonly<DocumentPreviewProps>) {
  const [activeTab, setActiveTab] = useState<"markdown" | "tables">("markdown");

  const tables = preview.tables ?? [];
  const wordCount = preview.metadata?.word_count ?? 0;
  const charCount = preview.metadata?.character_count ?? 0;

  return (
    <article className="preview-panel" aria-labelledby="preview-heading">
      <div className="preview-header">
        <h2 id="preview-heading">{preview.original_name}</h2>
        <span>
          {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars
          {tables.length > 0 ? ` · ${tables.length} table${tables.length === 1 ? "" : "s"}` : ""}
        </span>
      </div>

      <div className="preview-tabs" role="tablist">
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

      {activeTab === "markdown" ? (
        <pre tabIndex={0} aria-label="Extracted markdown text">
          {preview.markdown}
        </pre>
      ) : (
        <div className="table-wrapper">
          {tables.map((table, index) => {
            const markdownTable = typeof table.markdown === "string" ? table.markdown : "";
            const rows = Array.isArray(table.rows) ? (table.rows as Record<string, unknown>[]) : [];
            const columns = Array.isArray(table.columns) ? (table.columns as string[]) : [];

            return (
              <div key={index} style={{ marginBottom: "1.5rem" }}>
                <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>Table {index + 1}</p>
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

      <div className="export-actions" aria-label="Export document formats">
        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Export:</span>
        <button className="link-button" type="button" onClick={() => onDownload("markdown")}>
          Markdown
        </button>
        <button className="link-button" type="button" onClick={() => onDownload("json")}>
          JSON
        </button>
        <button className="link-button" type="button" onClick={() => onDownload("html")}>
          HTML
        </button>
        <button className="link-button" type="button" onClick={() => onDownload("txt")}>
          TXT
        </button>
      </div>
    </article>
  );
}
