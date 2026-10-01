"use client";

import { FormEvent, useState } from "react";

import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, isLoading, signIn, register, signOut } = useAuth();
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
        <section className="auth-card" aria-labelledby="welcome-heading">
          <p className="eyebrow">DocuMind</p>
          <h1 id="welcome-heading">Your workspace is ready.</h1>
          <p className="muted">Signed in as {user.email}. Document intelligence features are next.</p>
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
