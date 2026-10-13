"use client";

import { useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { ChatMessage, Citation } from "@/lib/types";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface ChatPanelProps {
  documentId: string;
  documentName: string;
  messages: ChatMessage[];
  asking: boolean;
  onAsk: (question: string) => Promise<void>;
  onClearHistory?: () => void;
  onSelectCitation?: (citation: Citation) => void;
}

export function ChatPanel({
  documentName,
  messages,
  asking,
  onAsk,
  onClearHistory,
  onSelectCitation,
}: Readonly<ChatPanelProps>) {
  const [question, setQuestion] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking) return;

    setQuestion("");
    await onAsk(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      const trimmed = question.trim();
      if (trimmed && !asking) {
        setQuestion("");
        void onAsk(trimmed);
      }
    }
  };

  const handleCopy = (id: string, text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <section className="preview-panel" aria-labelledby="chat-heading" style={{ marginTop: "1rem" }}>
      <div className="preview-header">
        <h3 id="chat-heading" style={{ margin: 0, fontSize: "0.95rem" }}>
          Grounded Q&amp;A: {documentName}
        </h3>
        {messages.length > 0 && onClearHistory && (
          <button
            className="link-button"
            type="button"
            onClick={onClearHistory}
            style={{ fontSize: "0.8rem", margin: 0 }}
          >
            Clear History
          </button>
        )}
      </div>

      {messages.length > 0 && (
        <div className="chat-history" aria-live="polite">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <strong style={{ fontSize: "0.8rem", color: msg.role === "user" ? "var(--text-secondary)" : "var(--accent)" }}>
                  {msg.role === "user" ? "You" : "DocuMind Assistant"}
                </strong>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {msg.role === "assistant" && (
                    <button
                      type="button"
                      className="copy-button"
                      onClick={() => handleCopy(msg.id, msg.content)}
                      aria-label="Copy response to clipboard"
                    >
                      {copiedId === msg.id ? "✓ Copied" : "Copy"}
                    </button>
                  )}
                  <small style={{ color: "var(--text-secondary)" }}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </small>
                </div>
              </div>

              {msg.role === "assistant" ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>
              )}

              {msg.citations && msg.citations.length > 0 && (
                <div className="citation-list" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.6rem" }}>
                  <strong style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>Verified Sources (click to view):</strong>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.3rem" }}>
                    {msg.citations.map((citation) => (
                      <button
                        key={citation.chunk_id}
                        type="button"
                        className="citation-chip"
                        onClick={() => onSelectCitation?.(citation)}
                        title={`Jump to section: ${citation.section || citation.chunk_id}`}
                      >
                        <span>📑 {citation.section || citation.chunk_id}</span>
                        {citation.page ? <span>(p. {citation.page})</span> : null}
                        <span>• {(citation.score * 100).toFixed(0)}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label htmlFor="document-question">
          Ask a question about this document <small style={{ color: "var(--text-secondary)" }}>(Ctrl+Enter to send)</small>
        </label>
        <textarea
          id="document-question"
          rows={3}
          value={question}
          disabled={asking}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What does the document state regarding...?"
        />
        <button
          className="button"
          type="submit"
          disabled={asking || !question.trim()}
        >
          {asking ? "Searching & Generating…" : "Ask question"}
        </button>
      </form>
    </section>
  );
}
