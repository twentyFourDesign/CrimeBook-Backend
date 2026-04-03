"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "../_lib/admin-session";

type IncidentRow = {
  id: string;
  crimeCategory: string;
  title: string | null;
  status: string;
  visibility: string;
  isAnonymous: boolean;
  latitude: number;
  longitude: number;
  locationAddress: string | null;
  locationLabel: string | null;
  caseId: string | null;
  createdAt: string;
  reporter: { id: string; name: string; email: string } | null;
};

type ApiOk<T> = { success: true; message: string; data: T };
type ApiErr = { success: false; message: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const STATUSES = [
  "SUBMITTED",
  "COMMUNITY_CONFIRMED",
  "POLICE_VERIFIED",
  "UNDER_INVESTIGATION",
  "RESOLVED",
  "REJECTED",
  "ARCHIVED",
] as const;

const CATEGORIES = [
  "ROBBERY",
  "ASSAULT",
  "KIDNAPPING",
  "DOMESTIC_VIOLENCE",
  "FRAUD",
  "MISSING_PERSON",
  "SUSPICIOUS_ACTIVITY",
  "VANDALISM",
  "DRUG_ACTIVITY",
  "TRAFFIC_CRIME",
  "OTHER",
] as const;

export default function AdminIncidentsPage() {
  const { accessToken, authHeaders } = useAdminSession();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [crimeCategory, setCrimeCategory] = useState<string>("");
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (pageNum?: number) => {
      if (!accessToken) return;
      const p = pageNum ?? page;
      setError(null);
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(p));
        params.set("pageSize", "30");
        if (status) params.set("status", status);
        if (crimeCategory) params.set("crimeCategory", crimeCategory);

        const res = await fetch(`/api/admin/incidents?${params.toString()}`, {
          headers: authHeaders(),
        });
        const payload = await parseJson<
          ApiOk<{ items: IncidentRow[]; total: number; totalPages: number }> | ApiErr
        >(res);
        if (!res.ok || !payload.success) {
          throw new Error("message" in payload ? payload.message : "Failed to load");
        }
        setRows(payload.data.items);
        setTotalPages(payload.data.totalPages);
        setTotal(payload.data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [accessToken, authHeaders, page, status, crimeCategory]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Incidents</h1>
        <p className="mt-1 text-sm text-slate-600">All incident reports in the system.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Status
          <select
            className="ml-2 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Category
          <select
            className="ml-2 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
            value={crimeCategory}
            onChange={(e) => {
              setPage(1);
              setCrimeCategory(e.target.value);
            }}
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          onClick={() => {
            setPage(1);
            void load(1);
          }}
        >
          Apply
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Reporter</th>
              <th className="px-4 py-3">Case</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No incidents.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{r.title?.trim() || r.crimeCategory.replace(/_/g, " ")}</p>
                    <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.status.replace(/_/g, " ")}</td>
                  <td className="max-w-[220px] px-4 py-3 text-xs text-slate-600">
                    {r.locationLabel || r.locationAddress || `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {r.isAnonymous || !r.reporter ? "Anonymous" : r.reporter.email}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.caseId ? "Linked" : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          Page {page} of {totalPages} ({total} total)
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
