"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/lib/api";
import type { AuthResponse, PublicUser } from "@/lib/types";

type AuthContextValue = {
  accessToken: string | null;
  user: PublicUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = (auth: AuthResponse) => {
    setAccessToken(auth.access_token);
    setUser(auth.user);
  };

  const signIn = useCallback(async (email: string, password: string) => {
    applyAuth(await apiFetch<AuthResponse>("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }));
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    applyAuth(await apiFetch<AuthResponse>("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }));
  }, []);

  const signOut = useCallback(async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    apiFetch<AuthResponse>("/auth/refresh", { method: "POST" })
      .then(applyAuth)
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo(
    () => ({ accessToken, user, isLoading, signIn, register, signOut }),
    [accessToken, user, isLoading, signIn, register, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
