"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "../_lib/admin-session";

type CaseRow = {
  id: string;
  caseNumber: string;
  status: string;
  priority: number;
  createdAt: string;
  reportId: string;
  report: {
    crimeCategory: string;
    title: string | null;
    descriptionPreview: string;
    status: string;
    locationLabel: string | null;
    locationAddress: string | null;
  };
  assignmentCount: number;
  leadOfficer: { id: string; name: string; email: string } | null;
};

type ApiOk<T> = { success: true; message: string; data: T };
type ApiErr = { success: false; message: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

const CASE_STATUSES = [
  "OPEN",
  "RESPONDING",
  "INVESTIGATING",
  "SUSPECT_DETAINED",
  "SUSPECT_ARRESTED",
  "CLOSED",
  "COLD_CASE",
] as const;

export default function AdminCasesPage() {
  const { accessToken, authHeaders } = useAdminSession();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>("");
  const [rows, setRows] = useState<CaseRow[]>([]);
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
        params.set("pageSize", "20");
        if (status) params.set("status", status);

        const res = await fetch(`/api/admin/cases?${params.toString()}`, {
          headers: authHeaders(),
        });
        const payload = await parseJson<
          ApiOk<{ items: CaseRow[]; total: number; totalPages: number }> | ApiErr
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
    [accessToken, authHeaders, page, status]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
        <p className="mt-1 text-sm text-slate-600">Case files linked to incident reports.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Case status
          <select
            className="ml-2 block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All</option>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
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
              <th className="px-4 py-3">Case #</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Report</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Assignments</th>
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
                  No cases.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/cases/${c.id}`}
                      className="font-mono text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.status.replace(/_/g, " ")}</td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="text-sm text-slate-900">{c.report.title?.trim() || c.report.crimeCategory}</p>
                    <p className="text-xs text-slate-500 line-clamp-2">{c.report.descriptionPreview}…</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {c.leadOfficer ? c.leadOfficer.name : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.assignmentCount}</td>
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
