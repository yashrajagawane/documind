"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignOut = async () => {
    queryClient.clear();
    await signOut();
  };

  const getFriendlyAuthError = (rawMessage: string): string => {
    const lower = rawMessage.toLowerCase();
    if (lower.includes("already registered") || lower.includes("409") || lower.includes("conflict")) {
      return "This email is already registered. Did you mean to sign in?";
    }
    if (lower.includes("validation") || lower.includes("422") || lower.includes("could not be validated")) {
      return "Please ensure your email is valid and your password is at least 12 characters.";
    }
    if (lower.includes("invalid email or password") || lower.includes("401") || lower.includes("unauthorized")) {
      return "Invalid email or password. Please verify your credentials and try again.";
    }
    return rawMessage;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") await signIn(email, password);
      else await register(email, password);
    } catch (requestError) {
      const rawMessage = requestError instanceof Error ? requestError.message : "Authentication failed.";
      setError(getFriendlyAuthError(rawMessage));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleMode = () => {
    setError(null);
    setShowPassword(false);
    setMode((prev) => (prev === "login" ? "register" : "login"));
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
        onSignOut={() => void handleSignOut()}
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
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              minLength={12}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby="password-hint"
            />
            <button
              type="button"
              className="password-toggle-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {/* Real-time length feedback */}
          <div id="password-hint" className="password-hint" aria-live="polite">
            {password.length >= 12 ? (
              <span className="password-hint-valid">
                <span aria-hidden="true">✓ </span>12+ characters entered
              </span>
            ) : (
              <span className="password-hint-info">
                {password.length > 0
                  ? `${12 - password.length} more character${12 - password.length === 1 ? "" : "s"} required (12 minimum)`
                  : "12 characters minimum required"}
              </span>
            )}
          </div>

          {error && (
            <div className="form-error-container" style={{ marginTop: "0.5rem" }}>
              <p className="form-error" role="alert">
                {error}
              </p>
              {error.includes("already registered") && mode === "register" && (
                <button
                  type="button"
                  className="link-button"
                  style={{ color: "var(--accent)", fontSize: "0.82rem", marginTop: "0.35rem", textDecoration: "underline" }}
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                >
                  Switch to Sign In
                </button>
              )}
            </div>
          )}
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <button
          className="link-button"
          type="button"
          style={{ marginTop: "1rem" }}
          onClick={handleToggleMode}
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
  const queryClient = useQueryClient();
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);
  /** Per-document conversation histories, keyed by document ID. */
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [asking, setAsking] = useState(false);
  const [highlightSection, setHighlightSection] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);
  /** Holds the active AbortController so generation can be cancelled. */
  const abortControllerRef = useRef<AbortController | null>(null);

  /* ── 1. Document List Query with visibility-aware smart polling ── */
  const {
    data: documents = [],
    isLoading: loading,
    error: docsError,
  } = useQuery({
    queryKey: ["documents", accessToken],
    queryFn: () => apiFetch<DocumentSummary[]>("/documents", {}, accessToken ?? undefined),
    enabled: !!accessToken,
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      const hasPending = data.some(
        (doc) => doc.status !== "ready" && doc.status !== "failed"
      );
      return hasPending ? 3000 : false;
    },
  });

  /* ── 2. Active Document Preview Query with automatic caching ──── */
  const {
    data: preview = null,
    error: previewError,
  } = useQuery<DocumentPreviewType | null>({
    queryKey: ["document-preview", selectedDocumentId, accessToken],
    queryFn: () =>
      selectedDocumentId
        ? apiFetch<DocumentPreviewType>(
            `/documents/${selectedDocumentId}/preview`,
            {},
            accessToken ?? undefined
          )
        : null,
    enabled: !!selectedDocumentId && !!accessToken,
  });

  const activeAlert =
    globalMessage ??
    (docsError instanceof Error
      ? docsError.message
      : docsError
      ? "Could not load documents."
      : null) ??
    (previewError instanceof Error
      ? previewError.message
      : previewError
      ? "Preview is not ready."
      : null);

  /* ── 3. Invalidate preview when processing doc reaches ready ──── */
  const selectedDocSummary = documents.find((doc) => doc.id === selectedDocumentId);
  const selectedDocStatus = selectedDocSummary?.status;

  useEffect(() => {
    if (selectedDocumentId && selectedDocStatus === "ready") {
      void queryClient.invalidateQueries({
        queryKey: ["document-preview", selectedDocumentId, accessToken],
      });
    }
  }, [selectedDocStatus, selectedDocumentId, accessToken, queryClient]);

  /** Messages for the currently previewed document. */
  const messages = preview ? (chatHistories[preview.id] ?? []) : [];

  const setMessages = (id: string, updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setChatHistories((prev) => ({
      ...prev,
      [id]: typeof updater === "function" ? updater(prev[id] ?? []) : updater,
    }));
  };

  /* ── 4. Mutations for Upload, Delete, and Retry ────────────────── */
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!accessToken) {
        throw new Error("Authentication required. Please sign in to upload documents.");
      }
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<DocumentSummary>(
        "/documents",
        {
          method: "POST",
          body: formData,
          headers: { "Idempotency-Key": crypto.randomUUID() },
        },
        accessToken
      );
    },
    onSuccess: (uploadedDoc) => {
      queryClient.setQueryData<DocumentSummary[]>(
        ["documents", accessToken],
        (prev = []) => [uploadedDoc, ...prev.filter((item) => item.id !== uploadedDoc.id)]
      );
      void queryClient.invalidateQueries({ queryKey: ["documents", accessToken] });
    },
  });

  const handleUpload = async (file: File) => {
    setGlobalMessage(null);
    await uploadMutation.mutateAsync(file);
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) return;
      return apiFetch<void>(`/documents/${id}`, { method: "DELETE" }, accessToken);
    },
    onMutate: (id) => {
      setDeletingId(id);
      setGlobalMessage(null);
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData<DocumentSummary[]>(
        ["documents", accessToken],
        (prev = []) => prev.filter((doc) => doc.id !== id)
      );
      void queryClient.invalidateQueries({ queryKey: ["documents", accessToken] });
      if (selectedDocumentId === id) {
        setSelectedDocumentId(null);
        setHighlightSection(null);
      }
      queryClient.removeQueries({ queryKey: ["document-preview", id, accessToken] });
      setChatHistories((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onError: (err) => {
      setGlobalMessage(
        err instanceof Error ? err.message : "Failed to delete the document. Please try again."
      );
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleRemove = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!accessToken) return;
      return apiFetch<DocumentSummary>(
        `/documents/${id}/retry`,
        { method: "POST" },
        accessToken
      );
    },
    onSuccess: (retriedDoc, id) => {
      if (retriedDoc) {
        queryClient.setQueryData<DocumentSummary[]>(
          ["documents", accessToken],
          (prev = []) => prev.map((doc) => (doc.id === id ? retriedDoc : doc))
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["documents", accessToken] });
    },
    onError: (err) => {
      setGlobalMessage(
        err instanceof Error ? err.message : "Could not retry document processing."
      );
    },
  });

  const handleRetry = async (id: string) => {
    await retryMutation.mutateAsync(id);
  };

  const handlePreview = (id: string) => {
    if (!accessToken) return;
    abortControllerRef.current?.abort();
    setSelectedDocumentId(id);
    setHighlightSection(null);
    setGlobalMessage(null);
  };

  const handleAbort = () => {
    abortControllerRef.current?.abort();
  };

  const handleAsk = async (questionText: string) => {
    if (!accessToken || !preview) return;
    const docId = preview.id;

    // Create a new AbortController for this generation
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAsking(true);
    setGlobalMessage(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: questionText,
      createdAt: new Date().toISOString(),
    };
    setMessages(docId, (prev) => [...prev, userMessage]);

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages(docId, (prev) => [...prev, assistantMessage]);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      for await (const { event, data } of apiStreamSSE(
        `/documents/${docId}/chat/stream`,
        { question: questionText, history },
        accessToken,
        0,
        controller.signal,
      )) {
        if (event === "citations") {
          const parsed = JSON.parse(data) as { citations: Citation[] };
          setMessages(docId, (prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, citations: parsed.citations } : m))
          );
        } else if (event === "token") {
          const parsed = JSON.parse(data) as { token: string };
          setMessages(docId, (prev) =>
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
      // Ignore AbortError — that is a user-initiated stop, not an error
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages(docId, (prev) =>
          prev.map((m) =>
            m.id === assistantId && m.content === ""
              ? { ...m, content: "(generation stopped)" }
              : m
          )
        );
      } else {
        setGlobalMessage(
          err instanceof Error ? err.message : "The question could not be answered."
        );
      }
    } finally {
      abortControllerRef.current = null;
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
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div className="workspace-shell">
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
          {activeAlert && (
            <div className="workspace-alert" role="alert">
              <span>⚠</span>
              <span>{activeAlert}</span>
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
              selectedDocumentId={selectedDocumentId ?? preview?.id}
              deletingId={deletingId}
              onPreview={(id) => handlePreview(id)}
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

        {/* ── CENTER PANE — Document Preview (Main Landmark) ───── */}
        <main
          id="main-content"
          className="workspace-center"
          aria-label="Document viewer"
          tabIndex={-1}
        >
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
        </main>

        {/* ── RIGHT PANE — Chat (Complementary Landmark) ───────── */}
        <aside className="workspace-chat" aria-label="AI chat panel">
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
              onClick={() => preview && setMessages(preview.id, [])}
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
            onAbort={handleAbort}
            onClearHistory={() => preview && setMessages(preview.id, [])}
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
        </aside>
      </div>
    </>
  );
}
