"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type ReactNode,
} from "react";

const TOKEN_KEY = "crime_admin_access_token";
const USER_KEY = "crime_admin_user";

export type AdminAppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  identityVerificationStatus?: string;
};

type AdminSessionContextValue = {
  accessToken: string | null;
  me: AdminAppUser | null;
  hydrated: boolean;
  setSession: (token: string, user: AdminAppUser) => void;
  logout: () => void;
  authHeaders: () => Record<string, string>;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [me, setMe] = useState<AdminAppUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const t = sessionStorage.getItem(TOKEN_KEY);
      const raw = sessionStorage.getItem(USER_KEY);
      startTransition(() => {
        if (t) setAccessToken(t);
        if (raw) {
          const u = JSON.parse(raw) as AdminAppUser;
          setMe(u);
        }
        setHydrated(true);
      });
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      startTransition(() => setHydrated(true));
    }
  }, []);

  const setSession = useCallback((token: string, user: AdminAppUser) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    setAccessToken(token);
    setMe(user);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setAccessToken(null);
    setMe(null);
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    if (!accessToken) return {};
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const value = useMemo(
    () => ({
      accessToken,
      me,
      hydrated,
      setSession,
      logout,
      authHeaders,
    }),
    [accessToken, me, hydrated, setSession, logout, authHeaders]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession() {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }
  return ctx;
}
