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

type Metric = {
  id: string;
  metricName: string;
  metricValue: number;
  dimension: string | null;
  periodStart: string;
  periodEnd: string;
  computedAt: string;
};

type Hotspot = {
  id: string;
  latitude: number;
  longitude: number;
  riskScore: number;
  crimeCategory: string | null;
  incidentCount: number;
};

type Pattern = {
  id: string;
  crimeCategory: string;
  dayOfWeek: number;
  hourOfDay: number;
  avgIncidentCount: number;
};

type AnalyticsPayload = {
  metrics: Metric[];
  hotspots: Hotspot[];
  patterns: Pattern[];
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminOverviewPage() {
  const { accessToken, authHeaders } = useAdminSession();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      const auth = authHeaders();
      const [statsRes, analyticsRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: auth }),
        fetch("/api/admin/analytics", { headers: auth }),
      ]);

      const statsPayload = await statsRes.json();
      const analyticsPayload = await analyticsRes.json();

      if (!statsRes.ok || !statsPayload.success) {
        throw new Error(statsPayload.message ?? "Failed to load stats");
      }
      setStats(statsPayload.data as StatsPayload);

      if (analyticsRes.ok && analyticsPayload.success) {
        setAnalytics(analyticsPayload.data as AnalyticsPayload);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders]);

  const computeAnalytics = async () => {
    if (!accessToken || computing) return;
    setComputing(true);
    try {
      const res = await fetch("/api/admin/analytics", {
        method: "POST",
        headers: authHeaders(),
      });
      const payload = await res.json();
      if (!res.ok || !payload.success) {
        throw new Error(payload.message ?? "Failed to compute analytics");
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to compute");
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
          <p className="mt-1 text-sm text-slate-600">Platform totals and verification queues.</p>
        </div>
        <button
          onClick={computeAnalytics}
          disabled={computing}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {computing ? "Computing..." : "Refresh Intelligence"}
        </button>
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

          {analytics?.metrics && analytics.metrics.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.metrics.map((m) => {
                let label = m.metricName.replace(/_/g, " ");
                let val = m.metricValue.toFixed(m.metricValue < 1 ? 2 : 1);
                let unit = m.metricName.includes("hours") ? " hrs" : "";
                return (
                  <div
                    key={m.id}
                    className="rounded-xl border border-blue-100 bg-blue-50/30 p-5 shadow-sm"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-600/80">
                      Operational Intelligence
                    </p>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-blue-900">
                      {val}
                      <span className="text-lg font-medium text-blue-700/60">{unit}</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-blue-800/70 capitalize">{label}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Hotspots Section */}
              {analytics?.hotspots && analytics.hotspots.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-sm font-semibold text-slate-900">High-Risk Hotspots</h2>
                    <Link href="/admin/map" className="text-xs font-medium text-blue-600 hover:underline">View on map</Link>
                  </div>
                  <div className="mt-4 divide-y divide-slate-100">
                    {analytics.hotspots.slice(0, 5).map((h) => (
                      <div key={h.id} className="flex items-center justify-between py-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900 capitalize">
                            {h.crimeCategory?.toLowerCase().replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-slate-500">
                            {h.incidentCount} incidents detected in area
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            h.riskScore > 70 ? "bg-red-100 text-red-700" : h.riskScore > 40 ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            Risk Score: {h.riskScore.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Temporal Patterns */}
              {analytics?.patterns && analytics.patterns.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-3">Temporal Peak Patterns</h2>
                  <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
                    {analytics.patterns.sort((a, b) => b.avgIncidentCount - a.avgIncidentCount).slice(0, 4).map((p) => (
                      <div key={p.id} className="rounded-lg bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-500 uppercase">{p.crimeCategory.replace(/_/g, " ")}</p>
                        <p className="mt-1 text-sm font-medium text-slate-900">
                          {DAYS[p.dayOfWeek]}s around {p.hourOfDay}:00
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {p.avgIncidentCount} incidents in window
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
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
          </div>
        </>
      ) : null}
    </div>
  );
}
