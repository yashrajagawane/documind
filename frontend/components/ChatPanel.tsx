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
  messages,
  asking,
  onAsk,
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
    <>
      {/* Scrollable message history */}
      <div className="chat-messages-area" aria-live="polite" aria-label="Chat history">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">💬</div>
            <p className="chat-empty-text">
              Ask anything about this document. Answers are grounded in the extracted content.
            </p>
          </div>
        ) : (
          <div className="chat-history">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-message ${msg.role}`}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.4rem",
                  }}
                >
                  <strong
                    style={{
                      fontSize: "0.75rem",
                      color: msg.role === "user" ? "var(--text-muted)" : "var(--accent)",
                    }}
                  >
                    {msg.role === "user" ? "You" : "DocuMind"}
                  </strong>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
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
                    <small style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </div>
                </div>

                {msg.role === "assistant" ? (
                  <MarkdownRenderer content={msg.content} />
                ) : (
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.87rem" }}>
                    {msg.content}
                  </p>
                )}

                {msg.citations && msg.citations.length > 0 && (
                  <div
                    className="citation-list"
                    style={{
                      marginTop: "0.65rem",
                      borderTop: "1px solid var(--border)",
                      paddingTop: "0.5rem",
                    }}
                  >
                    <strong style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      Sources (click to jump):
                    </strong>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.35rem",
                        marginTop: "0.3rem",
                      }}
                    >
                      {msg.citations.map((citation) => (
                        <button
                          key={citation.chunk_id}
                          type="button"
                          className="citation-chip"
                          onClick={() => onSelectCitation?.(citation)}
                          title={`Jump to: ${citation.section ?? citation.chunk_id}`}
                        >
                          <span>📑 {citation.section ?? citation.chunk_id}</span>
                          {citation.page ? <span>(p.{citation.page})</span> : null}
                          <span>· {(citation.score * 100).toFixed(0)}%</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* In-progress streaming indicator */}
            {asking && (
              <div className="chat-message assistant" style={{ opacity: 0.65 }}>
                <strong style={{ fontSize: "0.75rem", color: "var(--accent)" }}>DocuMind</strong>
                <p style={{ margin: "0.3rem 0 0", fontSize: "0.87rem", color: "var(--text-muted)" }}>
                  Searching &amp; generating…
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky input form at bottom of pane */}
      <div className="chat-input-area">
        <form className="chat-form" onSubmit={handleSubmit}>
          <label htmlFor="document-question">
            Question{" "}
            <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              (Ctrl+Enter to send)
            </span>
          </label>
          <textarea
            id="document-question"
            rows={3}
            value={question}
            disabled={asking}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What does the document state regarding…?"
          />
          <button
            className="button"
            type="submit"
            disabled={asking || !question.trim()}
          >
            {asking ? "Generating…" : "Ask question"}
          </button>
        </form>
      </div>
    </>
  );
}
