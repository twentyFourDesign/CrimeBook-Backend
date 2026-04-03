"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAdminSession } from "./_lib/admin-session";
import { KpiCard } from "./_components/KpiCard";

type StatsPayload = {
  users: {
    total: number;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  };
  incidents: { total: number; byStatus: Record<string, number> };
  cases: { total: number; byStatus: Record<string, number> };
  verifications: { pendingCommunity: number; pendingPolice: number };
};

export default function AdminOverviewPage() {
  const { accessToken, authHeaders } = useAdminSession();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { headers: authHeaders() });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message ?? "Failed to load stats");
      }
      setStats(payload.data as StatsPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-1 text-sm text-slate-600">Platform totals and verification queues.</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {loading && !stats ? (
        <p className="text-sm text-slate-500">Loading statistics…</p>
      ) : null}

      {stats ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Users" value={stats.users.total} subtitle="Registered accounts" />
            <KpiCard title="Incidents" value={stats.incidents.total} subtitle="Reports" />
            <KpiCard title="Cases" value={stats.cases.total} subtitle="Case files" />
            <KpiCard
              title="Pending verifications"
              value={stats.verifications.pendingCommunity + stats.verifications.pendingPolice}
              subtitle={`${stats.verifications.pendingCommunity} community · ${stats.verifications.pendingPolice} police`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Users by role</h2>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {Object.entries(stats.users.byRole).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k.replace(/_/g, " ")}</span>
                    <span className="font-medium tabular-nums text-slate-900">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Quick links</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link className="font-medium text-blue-600 hover:underline" href="/admin/verifications/community">
                    Community verification queue
                  </Link>
                </li>
                <li>
                  <Link className="font-medium text-blue-600 hover:underline" href="/admin/verifications/police">
                    Police onboarding queue
                  </Link>
                </li>
                <li>
                  <Link className="font-medium text-blue-600 hover:underline" href="/admin/map">
                    Incident map
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
