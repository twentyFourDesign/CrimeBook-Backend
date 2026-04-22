"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "../_lib/admin-session";

const USER_ROLES = [
  "CITIZEN",
  "VERIFIED_COMMUNITY_MEMBER",
  "POLICE_OFFICER",
  "POLICE_COMMAND",
  "ENTERPRISE_SECURITY",
  "SYSTEM_ADMIN",
] as const;

const USER_STATUSES = ["ACTIVE", "SUSPENDED", "PENDING_VERIFICATION", "DEACTIVATED"] as const;

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  username: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  officerBadge: string | null;
  officerDepartment: string | null;
  officerPrecinct: string | null;
  officerRank: string | null;
};

type ApiOk<T> = { success: true; message: string; data: T };
type ApiErr = { success: false; message: string };

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

type Props = {
  title: string;
  description: string;
  /** If set, API query includes `roles=` (comma-separated) and role filter is hidden */
  fixedRoles?: string;
};

export function UsersAdminTable({ title, description, fixedRoles }: Props) {
  const { accessToken, authHeaders, me } = useAdminSession();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async (pageOverride?: number) => {
    if (!accessToken) return;
    const pageNum = pageOverride ?? page;
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("pageSize", "20");
      if (fixedRoles) {
        params.set("roles", fixedRoles);
      } else if (role) {
        params.set("role", role);
      }
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: authHeaders(),
      });
      const payload = await parseJson<
        ApiOk<{
          items: AdminUserRow[];
          total: number;
          totalPages: number;
        }> | ApiErr
      >(res);
      if (!res.ok || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Failed to load users");
      }
      setRows(payload.data.items);
      setTotalPages(payload.data.totalPages);
      setTotal(payload.data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders, page, role, status, q, fixedRoles]);

  useEffect(() => {
    load();
  }, [load]);

  const patchStatus = async (userId: string, next: (typeof USER_STATUSES)[number]) => {
    if (!accessToken) return;
    setActionId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ status: next }),
      });
      const payload = await parseJson<ApiOk<unknown> | ApiErr>(res);
      if (!res.ok || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Update failed");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {!fixedRoles ? (
          <label className="flex flex-1 flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 sm:flex-none">
            Role
            <select
              className="block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900"
              value={role}
              onChange={(e) => {
                setPage(1);
                setRole(e.target.value);
              }}
            >
              <option value="">All Roles</option>
              {USER_ROLES.map((r: (typeof USER_ROLES)[number]) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-1 flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 sm:flex-none">
          Status
          <select
            className="block rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value);
            }}
          >
            <option value="">All Statuses</option>
            {USER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-full flex-col gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 sm:w-auto">
          Search
          <input
            className="block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900 sm:w-48"
            placeholder="Email or name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
        </label>
        <button
          type="button"
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 sm:flex-none sm:py-1.5"
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
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Officer</th>
              <th className="px-4 py-3 text-right">Actions</th>
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
                  No users found.
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{u.role.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                      {u.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="max-w-[200px] px-4 py-3 text-xs text-slate-600">
                    {u.officerBadge ? (
                      <>
                        <span className="font-mono">{u.officerBadge}</span>
                        {u.officerDepartment ? ` · ${u.officerDepartment}` : ""}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {u.role !== "SYSTEM_ADMIN" && u.id !== me?.id ? (
                        <>
                          {u.status !== "SUSPENDED" ? (
                            <button
                              type="button"
                              disabled={actionId === u.id}
                              className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                              onClick={() => patchStatus(u.id, "SUSPENDED")}
                            >
                              Suspend
                            </button>
                          ) : null}
                          {u.status !== "ACTIVE" ? (
                            <button
                              type="button"
                              disabled={actionId === u.id}
                              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                              onClick={() => patchStatus(u.id, "ACTIVE")}
                            >
                              Activate
                            </button>
                          ) : null}
                          {u.status !== "DEACTIVATED" ? (
                            <button
                              type="button"
                              disabled={actionId === u.id}
                              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                              onClick={() => patchStatus(u.id, "DEACTIVATED")}
                            >
                              Deactivate
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Protected</span>
                      )}
                    </div>
                  </td>
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
