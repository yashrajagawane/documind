"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  documentId: string;
  documentName: string;
  messages: ChatMessage[];
  asking: boolean;
  onAsk: (question: string) => Promise<void>;
  onClearHistory?: () => void;
}

export function ChatPanel({
  documentName,
  messages,
  asking,
  onAsk,
  onClearHistory,
}: Readonly<ChatPanelProps>) {
  const [question, setQuestion] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || asking) return;

    setQuestion("");
    await onAsk(trimmed);
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
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                <strong style={{ fontSize: "0.8rem", color: msg.role === "user" ? "var(--text-secondary)" : "var(--accent)" }}>
                  {msg.role === "user" ? "You" : "DocuMind Assistant"}
                </strong>
                <small style={{ color: "var(--text-secondary)" }}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </small>
              </div>
              <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{msg.content}</p>

              {msg.citations && msg.citations.length > 0 && (
                <div className="citation-list" style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "0.5rem" }}>
                  <strong style={{ fontSize: "0.8rem" }}>Verified Sources:</strong>
                  {msg.citations.map((citation) => (
                    <small key={citation.chunk_id}>
                      {citation.chunk_id}
                      {citation.section ? ` · ${citation.section}` : ""}
                      {citation.page ? ` · p. ${citation.page}` : ""}
                      {` · relevance ${(citation.score * 100).toFixed(0)}%`}
                    </small>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <form className="chat-form" onSubmit={handleSubmit} style={{ marginTop: "1rem" }}>
        <label htmlFor="document-question">Ask a question about this document</label>
        <textarea
          id="document-question"
          rows={3}
          value={question}
          disabled={asking}
          onChange={(event) => setQuestion(event.target.value)}
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
