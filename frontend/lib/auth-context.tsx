"use client";

import { createContext, useContext, useMemo, useState } from "react";

type AuthContextValue = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const value = useMemo(() => ({ accessToken, setAccessToken }), [accessToken]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
