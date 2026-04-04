"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "../../_lib/admin-session";

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

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;

export default function AdminCommunityVerificationsPage() {
  const { accessToken, authHeaders } = useAdminSession();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("PENDING");
  const [items, setItems] = useState<VerificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/community-verifications?status=${statusFilter}`, {
        headers: authHeaders(),
      });
      const payload = await parseJson<ApiOk<{ items: VerificationItem[] }> | ApiErr>(res);
      if (!res.ok || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Failed to load");
      }
      setItems(payload.data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={loading}
          onClick={load}
        >
          Refresh
        </button>
        {loading ? <span className="text-sm text-slate-500">Loading…</span> : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {items.length === 0 && !loading ? (
        <p className="text-sm text-slate-600">No items in this queue.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((v) => (
            <li key={v.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{v.user.name}</p>
                  <p className="text-sm text-slate-600">{v.user.email}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Doc: {v.idDocumentType} · Submitted {new Date(v.submittedAt).toLocaleString()}
                  </p>
                  {v.reviewNotes ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                      {v.reviewNotes}
                    </pre>
                  ) : null}
                </div>
                {statusFilter === "PENDING" ? (
                  <div className="flex flex-col gap-2 sm:min-w-[200px]">
                    <textarea
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
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
                ) : null}
              </div>
              <a
                href={v.idDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block truncate text-xs text-blue-600 hover:underline"
                title={v.idDocumentUrl}
              >
                Open document
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
