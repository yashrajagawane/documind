"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ChatPanel } from "@/components/ChatPanel";
import { DocumentList } from "@/components/DocumentList";
import { DocumentPreview } from "@/components/DocumentPreview";
import { UploadZone } from "@/components/UploadZone";
import { apiDownload, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { ChatMessage, ChatResponse, DocumentPreview as DocumentPreviewType, DocumentSummary } from "@/lib/types";

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
        <p>Restoring your session…</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-wide" aria-labelledby="welcome-heading">
          <p className="eyebrow">DocuMind</p>
          <h1 id="welcome-heading">Your workspace is ready.</h1>
          <p className="muted">Signed in as {user.email}. Upload a private document to begin.</p>
          <DocumentWorkspace accessToken={accessToken} />
          <button className="button" type="button" onClick={() => void signOut()} style={{ marginTop: "1.5rem" }}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-heading">
        <p className="eyebrow">DocuMind</p>
        <h1 id="auth-heading">{mode === "login" ? "Welcome back." : "Create your workspace."}</h1>
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
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

function DocumentWorkspace({ accessToken }: Readonly<{ accessToken: string | null }>) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<DocumentPreviewType | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [asking, setAsking] = useState(false);

  // Initial fetch on authentication
  useEffect(() => {
    if (!accessToken) return;
    let isCancelled = false;

    apiFetch<DocumentSummary[]>("/documents", {}, accessToken)
      .then((data) => {
        if (!isCancelled) setDocuments(data);
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setMessage(error instanceof Error ? error.message : "Could not load documents.");
        }
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [accessToken]);

  // Live polling: if any document is in non-terminal state, poll every 2.5 seconds
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

  const handleUpload = async (file: File) => {
    if (!accessToken) return;
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);

    const uploaded = await apiFetch<DocumentSummary>(
      "/documents",
      {
        method: "POST",
        body: formData,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      },
      accessToken
    );

    setDocuments((current) => [
      uploaded,
      ...current.filter((item) => item.id !== uploaded.id),
    ]);
  };

  const handleRemove = async (id: string) => {
    if (!accessToken) return;
    await apiFetch<void>(`/documents/${id}`, { method: "DELETE" }, accessToken);
    setDocuments((current) => current.filter((document) => document.id !== id));
    if (preview?.id === id) {
      setPreview(null);
      setMessages([]);
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
      setDocuments((current) =>
        current.map((doc) => (doc.id === id ? retried : doc))
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not retry document processing.");
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
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview is not ready.");
    }
  };

  const handleAsk = async (questionText: string) => {
    if (!accessToken || !preview) return;
    setAsking(true);
    setMessage(null);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: questionText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await apiFetch<ChatResponse>(
        `/documents/${preview.id}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: questionText, history }),
        },
        accessToken
      );

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: response.answer,
        citations: response.citations,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The question could not be answered.");
    } finally {
      setAsking(false);
    }
  };

  const handleDownload = async (format: string) => {
    if (!accessToken || !preview) return;
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
  };

  return (
    <div className="document-workspace">
      <UploadZone onUpload={handleUpload} />

      {message && (
        <p className="form-error" role="alert" style={{ marginTop: "1rem" }}>
          {message}
        </p>
      )}

      <DocumentList
        documents={documents}
        loading={loading}
        selectedDocumentId={preview?.id}
        onPreview={(id) => void handlePreview(id)}
        onDelete={(id) => void handleRemove(id)}
        onRetry={(id) => void handleRetry(id)}
      />

      {preview && (
        <>
          <DocumentPreview preview={preview} onDownload={(format) => void handleDownload(format)} />
          <ChatPanel
            documentId={preview.id}
            documentName={preview.original_name}
            messages={messages}
            asking={asking}
            onAsk={handleAsk}
            onClearHistory={() => setMessages([])}
          />
        </>
      )}
    </div>
  );
}
