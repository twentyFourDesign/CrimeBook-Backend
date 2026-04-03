"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "../../_lib/admin-session";

type PoliceApplicationItem = {
  id: string;
  userId: string;
  badgeNumber: string;
  rank: string;
  department: string;
  precinct: string;
  unitCode: string | null;
  idDocumentUrl: string | null;
  verificationStatus: string;
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

export default function AdminPoliceVerificationsPage() {
  const { accessToken, authHeaders } = useAdminSession();
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>("PENDING");
  const [items, setItems] = useState<PoliceApplicationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policeNoteById, setPoliceNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/police-applications?status=${statusFilter}`, {
        headers: authHeaders(),
      });
      const payload = await parseJson<ApiOk<{ items: PoliceApplicationItem[] }> | ApiErr>(res);
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

  const patchPoliceApplication = async (id: string, action: "approve" | "reject") => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const notes = policeNoteById[id]?.trim();
      const res = await fetch(`/api/admin/police-applications/${id}`, {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Police onboarding</h1>
        <p className="mt-1 text-sm text-slate-600">Review officer applications and badge details.</p>
      </div>

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
          {items.map((p) => (
            <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{p.user.name}</p>
                  <p className="text-sm text-slate-600">{p.user.email}</p>
                  <p className="mt-2 text-sm text-slate-800">
                    Badge <span className="font-mono font-semibold">{p.badgeNumber}</span> · {p.rank}
                  </p>
                  <p className="text-sm text-slate-700">
                    {p.department} — {p.precinct}
                    {p.unitCode ? ` · Unit ${p.unitCode}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Submitted {new Date(p.submittedAt).toLocaleString()}
                  </p>
                  {p.reviewNotes ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-xs text-slate-700">
                      {p.reviewNotes}
                    </pre>
                  ) : null}
                </div>
                {statusFilter === "PENDING" ? (
                  <div className="flex flex-col gap-2 sm:min-w-[200px]">
                    <textarea
                      className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-900"
                      placeholder="Optional note"
                      rows={2}
                      value={policeNoteById[p.id] ?? ""}
                      onChange={(e) => setPoliceNoteById((m) => ({ ...m, [p.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        disabled={loading}
                        onClick={() => patchPoliceApplication(p.id, "approve")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        disabled={loading}
                        onClick={() => patchPoliceApplication(p.id, "reject")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              {p.idDocumentUrl ? (
                <a
                  href={p.idDocumentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block truncate text-xs text-blue-600 hover:underline"
                >
                  Open document
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
