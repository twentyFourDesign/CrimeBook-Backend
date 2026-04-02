"use client";

import { useCallback, useEffect, useState } from "react";

type AppUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  identityVerificationStatus: string;
};

type VerificationItem = {
  id: string;
  userId: string;
  verificationStatus: string;
  idDocumentType: string;
  idDocumentUrl: string;
  reviewNotes: string | null;
  submittedAt: string;
  user: { id: string; email: string; name: string; role: string };
};

type ApiOk<T> = { success: true; message: string; data: T };
type ApiErr = { success: false; message: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export default function AdminCommunityPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [me, setMe] = useState<AppUser | null>(null);
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const authHeaders = useCallback((): Record<string, string> => {
    if (!accessToken) return {};
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

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
        ApiOk<{ user: AppUser; accessToken: string; refreshToken: string } | { requiresOtp: boolean; email: string }> | ApiErr
      >(res);
      if (!res.ok || !("success" in payload) || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Login failed");
      }
      const data = payload.data;
      if ("requiresOtp" in data && data.requiresOtp) {
        throw new Error("This account requires OTP sign-in. Use a SYSTEM_ADMIN account with password-only login.");
      }
      if (!("accessToken" in data)) {
        throw new Error("Unexpected login response");
      }
      setAccessToken(data.accessToken);
      setMe(data.user);
      if (data.user.role !== "SYSTEM_ADMIN") {
        setError("Signed in, but this user is not SYSTEM_ADMIN. Admin APIs will return 403.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/community-verifications?status=PENDING", {
        headers: authHeaders(),
      });
      const payload = await parseJson<ApiOk<{ items: VerificationItem[] }> | ApiErr>(res);
      if (!res.ok || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Failed to load queue");
      }
      setItems(payload.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    if (accessToken) loadQueue();
  }, [accessToken, loadQueue]);

  const patchVerification = async (id: string, action: "approve" | "reject") => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const notes = noteById[id]?.trim();
      const res = await fetch(`/api/admin/community-verifications/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          action,
          reviewNotes: notes || undefined,
        }),
      });
      const payload = await parseJson<ApiOk<unknown> | ApiErr>(res);
      if (!res.ok || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Update failed");
      }
      await loadQueue();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAccessToken(null);
    setMe(null);
    setItems([]);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-zinc-900">Community verification</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sign in with a <code className="rounded bg-zinc-100 px-1 py-0.5">SYSTEM_ADMIN</code> account to approve or
        reject citizen identity applications.
      </p>

      {!accessToken ? (
        <div className="mt-8 space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <label className="block text-sm font-medium text-zinc-700">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={loading}
            onClick={login}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-700">
              Signed in as <span className="font-medium">{me?.email}</span> ({me?.role})
            </p>
            <button
              type="button"
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800"
              onClick={logout}
            >
              Sign out
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              disabled={loading}
              onClick={loadQueue}
            >
              Refresh
            </button>
            {loading && <span className="text-sm text-zinc-500">Loading…</span>}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}

          {items.length === 0 && !loading ? (
            <p className="text-sm text-zinc-600">No pending verifications.</p>
          ) : (
            <ul className="space-y-4">
              {items.map((v) => (
                <li key={v.id} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-zinc-900">{v.user.name}</p>
                      <p className="text-sm text-zinc-600">{v.user.email}</p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Doc: {v.idDocumentType} · Submitted {new Date(v.submittedAt).toLocaleString()}
                      </p>
                      {v.reviewNotes && (
                        <pre className="mt-2 max-h-40 overflow-auto rounded bg-zinc-50 p-2 text-xs text-zinc-700">
                          {v.reviewNotes}
                        </pre>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 sm:min-w-[200px]">
                      <textarea
                        className="rounded-lg border border-zinc-300 px-2 py-1 text-xs"
                        placeholder="Optional note"
                        rows={2}
                        value={noteById[v.id] ?? ""}
                        onChange={(e) => setNoteById((m) => ({ ...m, [v.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          disabled={loading}
                          onClick={() => patchVerification(v.id, "approve")}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                          disabled={loading}
                          onClick={() => patchVerification(v.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 truncate text-xs text-zinc-400" title={v.idDocumentUrl}>
                    {v.idDocumentUrl}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
