"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { DocumentSummary } from "@/lib/types";

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

  if (isLoading) return <main className="auth-shell"><p>Restoring your session…</p></main>;

  if (user) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-wide" aria-labelledby="welcome-heading">
          <p className="eyebrow">DocuMind</p>
          <h1 id="welcome-heading">Your workspace is ready.</h1>
          <p className="muted">Signed in as {user.email}. Upload a private document to begin.</p>
          <DocumentWorkspace accessToken={accessToken} />
          <button className="button" type="button" onClick={() => void signOut()}>Sign out</button>
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
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" minLength={12} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button" type="submit" disabled={submitting}>{submitting ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <button className="link-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}

function DocumentWorkspace({ accessToken }: Readonly<{ accessToken: string | null }>) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    apiFetch<DocumentSummary[]>("/documents", {}, accessToken)
      .then(setDocuments)
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load documents."))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !accessToken) return;
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const document = await apiFetch<DocumentSummary>("/documents", {
        method: "POST",
        body: formData,
        headers: { "Idempotency-Key": crypto.randomUUID() },
      }, accessToken);
      setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      setFile(null);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const remove = async (id: string) => {
    if (!accessToken) return;
    await apiFetch<void>(`/documents/${id}`, { method: "DELETE" }, accessToken);
    setDocuments((current) => current.filter((document) => document.id !== id));
  };

  return (
    <div className="document-workspace">
      <form className="upload-form" onSubmit={upload}>
        <label htmlFor="document-file">Upload a document</label>
        <input id="document-file" type="file" accept=".pdf,.docx,.xlsx,.pptx,.txt,.csv,.md" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <button className="button" type="submit" disabled={!file}>Upload privately</button>
      </form>
      {message && <p className="form-error" role="alert">{message}</p>}
      {loading ? <p className="muted">Loading your documents…</p> : documents.length === 0 ? <p className="muted">No documents yet.</p> : (
        <ul className="document-list">
          {documents.map((document) => <li key={document.id}><span><strong>{document.original_name}</strong><small>{document.status}</small></span><button className="link-button" type="button" onClick={() => void remove(document.id)}>Delete</button></li>)}
        </ul>
      )}
    </div>
  );
}
