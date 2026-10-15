"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { DocumentList } from "@/components/DocumentList";
import { DocumentPreview } from "@/components/DocumentPreview";
import { UploadZone } from "@/components/UploadZone";
import { apiDownload, apiFetch, apiStreamSSE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type {
  ChatMessage,
  Citation,
  DocumentPreview as DocumentPreviewType,
  DocumentSummary,
} from "@/lib/types";

/* ──────────────────────────────────────────────────────────────────
   Root page — shows auth form or workspace shell
────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  const { accessToken, user, isLoading, signIn, register, signOut } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") await signIn(email, password);
      else await register(email, password);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="auth-shell">
        <p className="muted">Restoring your session…</p>
      </main>
    );
  }

  if (user) {
    return (
      <DocumentWorkspace
        accessToken={accessToken}
        userEmail={user.email}
        onSignOut={() => void signOut()}
      />
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-heading">
        <p className="eyebrow">DocuMind</p>
        <h1 id="auth-heading">
          {mode === "login" ? "Welcome back." : "Create your workspace."}
        </h1>
        <p className="muted">Secure document intelligence starts with a private account.</p>
        <form onSubmit={submit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            minLength={12}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          className="link-button"
          type="button"
          style={{ marginTop: "1rem" }}
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

/* ──────────────────────────────────────────────────────────────────
   3-Pane Document Workspace
────────────────────────────────────────────────────────────────── */
interface WorkspaceProps {
  accessToken: string | null;
  userEmail: string;
  onSignOut: () => void;
}

function DocumentWorkspace({ accessToken, userEmail, onSignOut }: Readonly<WorkspaceProps>) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<DocumentPreviewType | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  /* ── Initial document fetch ─────────────────────────────────── */
  useEffect(() => {
    if (!accessToken) return;
    let isCancelled = false;

    apiFetch<DocumentSummary[]>("/documents", {}, accessToken)
      .then((data) => { if (!isCancelled) setDocuments(data); })
      .catch((err: unknown) => {
        if (!isCancelled)
          setGlobalMessage(err instanceof Error ? err.message : "Could not load documents.");
      })
      .finally(() => { if (!isCancelled) setLoading(false); });

    return () => { isCancelled = true; };
  }, [accessToken]);

  /* ── Background polling for in-progress documents ───────────── */
  const hasPending = documents.some(
    (doc) => doc.status !== "ready" && doc.status !== "failed"
  );

  useEffect(() => {
    if (!hasPending || !accessToken) return;
    const timer = setInterval(() => {
      apiFetch<DocumentSummary[]>("/documents", {}, accessToken)
        .then(setDocuments)
        .catch(() => undefined);
    }, 2500);
    return () => clearInterval(timer);
  }, [hasPending, accessToken]);

  /* ── Handlers ───────────────────────────────────────────────── */
  const handleUpload = async (file: File) => {
    if (!accessToken) {
      throw new Error("Authentication required. Please sign in to upload documents.");
    }
    setGlobalMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    const uploaded = await apiFetch<DocumentSummary>(
      "/documents",
      { method: "POST", body: formData, headers: { "Idempotency-Key": crypto.randomUUID() } },
      accessToken
    );
    setDocuments((current) => [uploaded, ...current.filter((item) => item.id !== uploaded.id)]);
  };

  const handleRemove = async (id: string) => {
    if (!accessToken) return;
    setDeletingId(id);
    setGlobalMessage(null);
    try {
      await apiFetch<void>(`/documents/${id}`, { method: "DELETE" }, accessToken);
      setDocuments((current) => current.filter((doc) => doc.id !== id));
      if (preview?.id === id) {
        setPreview(null);
        setMessages([]);
        setHighlightSection(null);
      }
    } catch (err) {
      setGlobalMessage(
        err instanceof Error ? err.message : "Failed to delete the document. Please try again."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleRetry = async (id: string) => {
    if (!accessToken) return;
    try {
      const retried = await apiFetch<DocumentSummary>(
        `/documents/${id}/retry`,
        { method: "POST" },
        accessToken
      );
      setDocuments((current) => current.map((doc) => (doc.id === id ? retried : doc)));
    } catch (err) {
      setGlobalMessage(err instanceof Error ? err.message : "Could not retry document processing.");
    }
  };

  const handlePreview = async (id: string) => {
    if (!accessToken) return;
    try {
      const previewData = await apiFetch<DocumentPreviewType>(
        `/documents/${id}/preview`,
        {},
        accessToken
      );
      setPreview(previewData);
      setMessages([]);
      setHighlightSection(null);
      setGlobalMessage(null);
    } catch (err) {
      setGlobalMessage(err instanceof Error ? err.message : "Preview is not ready.");
    }
  };

  const handleAsk = async (questionText: string) => {
    if (!accessToken || !preview) return;
    setAsking(true);
    setGlobalMessage(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: questionText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      for await (const { event, data } of apiStreamSSE(
        `/documents/${preview.id}/chat/stream`,
        { question: questionText, history },
        accessToken
      )) {
        if (event === "citations") {
          const parsed = JSON.parse(data) as { citations: Citation[] };
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, citations: parsed.citations } : m))
          );
        } else if (event === "token") {
          const parsed = JSON.parse(data) as { token: string };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + parsed.token } : m
            )
          );
        } else if (event === "error") {
          const parsed = JSON.parse(data) as { error: string };
          setGlobalMessage(parsed.error);
        }
      }
    } catch (err) {
      setGlobalMessage(
        err instanceof Error ? err.message : "The question could not be answered."
      );
    } finally {
      setAsking(false);
    }
  };

  const handleDownload = async (format: string) => {
    if (!accessToken || !preview) return;
    setExportingFormat(format);
    setGlobalMessage(null);
    try {
      const blob = await apiDownload(
        `/documents/${preview.id}/export?format=${format}`,
        accessToken
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${preview.original_name}.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setGlobalMessage(
        err instanceof Error ? err.message : `Failed to export as ${format}. Please try again.`
      );
    } finally {
      setExportingFormat(null);
    }
  };

  /* ── Layout ─────────────────────────────────────────────────── */
  const wordCount = preview?.metadata?.word_count ?? 0;
  const tableCount = preview?.tables?.length ?? 0;

  return (
    <main className="workspace-shell">
      {/* ── LEFT SIDEBAR ──────────────────────────────────────── */}
      <aside className="workspace-sidebar" aria-label="Navigation sidebar">
        {/* Brand header */}
        <div className="sidebar-header">
          <p className="sidebar-brand">DocuMind</p>
        </div>

        {/* Upload zone */}
        <div className="sidebar-upload-zone">
          <UploadZone onUpload={handleUpload} disabled={!accessToken} compact />
        </div>

        {/* Error alert */}
        {globalMessage && (
          <div className="workspace-alert" role="alert">
            <span>⚠</span>
            <span>{globalMessage}</span>
          </div>
        )}

        {/* Document list heading */}
        <div className="sidebar-docs-heading">
          <span>Documents</span>
          <span style={{ color: "var(--text-muted)" }}>
            {documents.length > 0 ? documents.length : ""}
          </span>
        </div>

        {/* Document list */}
        <div className="sidebar-doc-list">
          <DocumentList
            documents={documents}
            loading={loading}
            selectedDocumentId={preview?.id}
            deletingId={deletingId}
            onPreview={(id) => void handlePreview(id)}
            onDelete={(id) => void handleRemove(id)}
            onRetry={(id) => void handleRetry(id)}
          />
        </div>

        {/* Footer — user email + sign out */}
        <div className="sidebar-footer">
          <span className="sidebar-user-email" title={userEmail}>
            {userEmail}
          </span>
          <button
            type="button"
            className="link-button sidebar-signout"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ── CENTER PANE — Document Preview ────────────────────── */}
      <div className="workspace-center">
        {preview ? (
          <>
            {/* Sticky header */}
            <div className="center-header">
              <span className="center-doc-title" title={preview.original_name}>
                {preview.original_name}
              </span>
              <span className="center-doc-meta">
                {wordCount.toLocaleString()} words
                {tableCount > 0 ? ` · ${tableCount} table${tableCount === 1 ? "" : "s"}` : ""}
              </span>
            </div>

            {/* Scrollable content */}
            <div className="center-body">
              <DocumentPreview
                preview={preview}
                highlightSection={highlightSection}
                exporting={exportingFormat}
                onDownload={(format) => void handleDownload(format)}
              />
            </div>
          </>
        ) : (
          <>
            <div className="center-header">
              <span className="center-doc-title" style={{ color: "var(--text-muted)" }}>
                No document selected
              </span>
            </div>
            <div className="center-body">
              <div className="center-empty">
                <div className="center-empty-icon">📄</div>
                <p className="center-empty-title">Select a document to preview</p>
                <p className="center-empty-desc">
                  Upload a file using the sidebar, then click{" "}
                  <strong>Preview</strong> on a ready document to view its extracted content here.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── RIGHT PANE — Chat ─────────────────────────────────── */}
      <div className="workspace-chat" aria-label="AI chat panel">
        <div className="chat-pane-header">
          <div style={{ minWidth: 0 }}>
            <p className="chat-pane-label">Grounded Q&amp;A</p>
            {preview ? (
              <p className="chat-pane-title" title={preview.original_name}>
                {preview.original_name}
              </p>
            ) : (
              <p className="chat-pane-title" style={{ color: "var(--text-muted)" }}>
                No document selected
              </p>
            )}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              className="link-button"
              style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}
              onClick={() => setMessages([])}
            >
              Clear
            </button>
          )}
        </div>

        {preview ? (
          <ChatPanel
            documentId={preview.id}
            documentName={preview.original_name}
            messages={messages}
            asking={asking}
            onAsk={handleAsk}
            onClearHistory={() => setMessages([])}
            onSelectCitation={(citation: Citation) => {
              if (citation.section) setHighlightSection(citation.section);
            }}
          />
        ) : (
          <div className="chat-messages-area">
            <div className="chat-empty-state">
              <div className="chat-empty-icon">💬</div>
              <p className="chat-empty-text">
                Select a document from the sidebar to start asking questions.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
