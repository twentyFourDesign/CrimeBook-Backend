"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { useAdminSession, type AdminAppUser } from "../_lib/admin-session";

type ApiOk<T> = { success: true; message: string; data: T };
type ApiErr = { success: false; message: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { accessToken, me, hydrated, setSession, logout } = useAdminSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const payload = await parseJson<
        | ApiOk<{ user: AdminAppUser; accessToken: string; refreshToken: string } | { requiresOtp: boolean; email: string }>
        | ApiErr
      >(res);
      if (!res.ok || !("success" in payload) || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Login failed");
      }
      const data = payload.data;
      if ("requiresOtp" in data && data.requiresOtp) {
        throw new Error("This account requires OTP. Use a SYSTEM_ADMIN account with password-only login.");
      }
      if (!("accessToken" in data)) {
        throw new Error("Unexpected login response");
      }
      setSession(data.accessToken, data.user);
      if (data.user.role !== "SYSTEM_ADMIN") {
        setError("Signed in, but this user is not SYSTEM_ADMIN. Admin APIs will return 403.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-md px-4 py-16">
          <h1 className="text-2xl font-semibold text-slate-900">Admin sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with a <code className="rounded bg-white px-1 py-0.5 text-slate-800 shadow-sm">SYSTEM_ADMIN</code>{" "}
            account.
          </p>
          <div className="mt-8 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button
              type="button"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={loading}
              onClick={login}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Signed in</p>
            <p className="text-sm font-semibold text-slate-900">{me?.email}</p>
            <p className="text-xs text-slate-500">{me?.role}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
            onClick={logout}
          >
            Sign out
          </button>
        </header>
        <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
