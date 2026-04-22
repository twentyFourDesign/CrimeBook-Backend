"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminSession } from "../_lib/admin-session";
import { AreaChart } from "./_components/AreaChart";
import { HorizontalBarChart } from "./_components/BarChart";
import { DonutChart } from "./_components/DonutChart";
import { HeatGrid } from "./_components/HeatGrid";
import { FilterBar, CATEGORY_COLORS, STATUS_COLORS, type Filters } from "./_components/FilterBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type IncidentPt = {
  id: string;
  crimeCategory: string;
  status: string;
  createdAt: string;
  credibilityScore: number;
  latitude: number | null;
  longitude: number | null;
  isAnonymous: boolean;
};

type StatsPayload = {
  users: { total: number; byRole: Record<string, number>; byStatus: Record<string, number> };
  incidents: { total: number; byStatus: Record<string, number> };
  cases: { total: number; byStatus: Record<string, number> };
  verifications: { pendingCommunity: number; pendingPolice: number };
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

type Metric = {
  id: string;
  metricName: string;
  metricValue: number;
  dimension: string | null;
};

type AnalyticsPayload = { hotspots: Hotspot[]; patterns: Pattern[]; metrics: Metric[] };

type ApiOk<T> = { success: true; data: T };
type ApiErr = { success: false; message: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(s: string) {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTimeRangeCutoff(range: Filters["timeRange"]): Date | null {
  if (range === "all") return null;
  const now = new Date();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
  now.setDate(now.getDate() - days);
  return now;
}

function bucketByDay(items: IncidentPt[], range: Filters["timeRange"]): { label: string; value: number }[] {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : range === "1y" ? 365 : null;
  const now = new Date();

  if (days === null) {
    // Monthly buckets for "all time"
    const map: Record<string, number> = {};
    for (const item of items) {
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({
      label: k,
      value: v,
    }));
  }

  // Daily buckets
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets[key] = 0;
  }
  for (const item of items) {
    const key = new Date(item.createdAt).toISOString().slice(0, 10);
    if (key in buckets) buckets[key]++;
  }
  const step = days > 30 ? 7 : 1;
  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => ({ label: k.slice(5), value: v }))
    .filter((_, i) => i % step === 0);
}

function StatCard({
  title,
  value,
  subtitle,
  accent,
  delta,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  accent: string;
  delta?: { label: string; positive: boolean } | null;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/60 bg-white/80 backdrop-blur-sm p-6 shadow-md ring-1 ring-slate-200/60 transition-all hover:shadow-lg hover:-translate-y-0.5"
    >
      <div
        className="absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10"
        style={{ background: accent }}
      />
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <p
        className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight"
        style={{ color: accent }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      {delta && (
        <span
          className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            delta.positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {delta.positive ? "↑" : "↓"} {delta.label}
        </span>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm p-6 shadow-sm ring-1 ring-slate-200/40">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { accessToken, authHeaders } = useAdminSession();
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);
  const [incidents, setIncidents] = useState<IncidentPt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    timeRange: "30d",
    categories: [],
    statuses: [],
  });

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    setLoading(true);
    try {
      const auth = authHeaders();
      const [statsRes, analyticsRes, incRes] = await Promise.all([
        fetch("/api/admin/stats", { headers: auth }),
        fetch("/api/admin/analytics", { headers: auth }),
        fetch("/api/admin/incidents?pageSize=1000", { headers: auth }),
      ]);

      const [statsJson, analyticsJson, incJson] = await Promise.all([
        statsRes.json() as Promise<ApiOk<StatsPayload> | ApiErr>,
        analyticsRes.json() as Promise<ApiOk<AnalyticsPayload> | ApiErr>,
        incRes.json() as Promise<ApiOk<{ items: IncidentPt[] }> | ApiErr>,
      ]);

      if (!statsRes.ok || !statsJson.success) throw new Error("Failed to load stats");
      setStats((statsJson as ApiOk<StatsPayload>).data);

      if (analyticsRes.ok && analyticsJson.success)
        setAnalytics((analyticsJson as ApiOk<AnalyticsPayload>).data);

      if (incRes.ok && incJson.success)
        setIncidents((incJson as ApiOk<{ items: IncidentPt[] }>).data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => { load(); }, [load]);

  const computeAnalytics = async () => {
    if (!accessToken || computing) return;
    setComputing(true);
    try {
      const res = await fetch("/api/admin/analytics", { method: "POST", headers: authHeaders() });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message ?? "Failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setComputing(false);
    }
  };

  // ─── Filtered incidents ───────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const cutoff = getTimeRangeCutoff(filters.timeRange);
    return incidents.filter((inc) => {
      if (cutoff && new Date(inc.createdAt) < cutoff) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(inc.crimeCategory)) return false;
      if (filters.statuses.length > 0 && !filters.statuses.includes(inc.status)) return false;
      return true;
    });
  }, [incidents, filters]);

  // ─── Derived chart data ───────────────────────────────────────────────────
  const timeSeries = useMemo(() => bucketByDay(filtered, filters.timeRange), [filtered, filters.timeRange]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inc of filtered) map[inc.crimeCategory] = (map[inc.crimeCategory] ?? 0) + 1;
    return Object.entries(map).map(([label, value]) => ({
      label,
      value,
      color: CATEGORY_COLORS[label] ?? "#94a3b8",
    }));
  }, [filtered]);

  const byStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const inc of filtered) map[inc.status] = (map[inc.status] ?? 0) + 1;
    return Object.entries(map).map(([label, value]) => ({
      label,
      value,
      color: STATUS_COLORS[label] ?? "#94a3b8",
    }));
  }, [filtered]);

  const credBuckets = useMemo(() => {
    const buckets = [
      { label: "0-20", min: 0, max: 20, value: 0 },
      { label: "21-40", min: 21, max: 40, value: 0 },
      { label: "41-60", min: 41, max: 60, value: 0 },
      { label: "61-80", min: 61, max: 80, value: 0 },
      { label: "81-100", min: 81, max: 100, value: 0 },
    ];
    for (const inc of filtered) {
      const score = inc.credibilityScore ?? 50;
      const b = buckets.find((b) => score >= b.min && score <= b.max);
      if (b) b.value++;
    }
    return buckets.map((b, i) => ({
      label: b.label,
      value: b.value,
      color: ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e"][i],
    }));
  }, [filtered]);

  const resolvedCount = useMemo(
    () => filtered.filter((i) => i.status === "RESOLVED" || i.status === "POLICE_RESOLVED").length,
    [filtered]
  );
  const resolutionRate = filtered.length > 0 ? Math.round((resolvedCount / filtered.length) * 100) : 0;
  const anonymousCount = useMemo(() => filtered.filter((i) => i.isAnonymous).length, [filtered]);
  const anonPct = filtered.length > 0 ? Math.round((anonymousCount / filtered.length) * 100) : 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  const labelEvery =
    timeSeries.length > 60 ? 12 :
    timeSeries.length > 30 ? 6 :
    timeSeries.length > 14 ? 3 : 1;

  return (
    <div
      className="space-y-8 min-h-screen"
      style={{
        background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 50%, #faf5ff 100%)",
        margin: "-24px",
        padding: "24px",
      }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Analytics
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Platform-wide intelligence · {incidents.length.toLocaleString()} incidents indexed
          </p>
        </div>
        <button
          onClick={computeAnalytics}
          disabled={computing}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-indigo-700 hover:to-purple-700 disabled:opacity-60 transition-all"
        >
          <svg className={`h-4 w-4 ${computing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {computing ? "Computing…" : "Refresh Intelligence"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
            <p className="text-sm text-slate-500">Loading analytics…</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Users"
              value={stats?.users.total ?? 0}
              subtitle="Registered accounts"
              accent="#6366f1"
            />
            <StatCard
              title="Incidents"
              value={filtered.length}
              subtitle={filters.timeRange !== "all" ? `In last ${filters.timeRange}` : "All time"}
              accent="#f97316"
            />
            <StatCard
              title="Resolution Rate"
              value={`${resolutionRate}%`}
              subtitle={`${resolvedCount} of ${filtered.length} resolved`}
              accent="#22c55e"
            />
            <StatCard
              title="Cases"
              value={stats?.cases.total ?? 0}
              subtitle="Active case files"
              accent="#8b5cf6"
            />
          </div>

          {/* Quick metrics row */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white/70 px-5 py-3 backdrop-blur-sm shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Anonymous</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{anonPct}%</p>
              <p className="text-xs text-slate-500">{anonymousCount} anonymous reports</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-5 py-3 backdrop-blur-sm shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pending Verif.</p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {(stats?.verifications.pendingCommunity ?? 0) + (stats?.verifications.pendingPolice ?? 0)}
              </p>
              <p className="text-xs text-slate-500">
                {stats?.verifications.pendingCommunity ?? 0} community · {stats?.verifications.pendingPolice ?? 0} police
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-5 py-3 backdrop-blur-sm shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">High Risk Zones</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {analytics?.hotspots.filter((h) => h.riskScore > 70).length ?? 0}
              </p>
              <p className="text-xs text-slate-500">
                of {analytics?.hotspots.length ?? 0} total hotspots
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/70 px-5 py-3 backdrop-blur-sm shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Avg. Credibility</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {filtered.length > 0
                  ? Math.round(filtered.reduce((s, i) => s + (i.credibilityScore ?? 50), 0) / filtered.length)
                  : "—"}
                {filtered.length > 0 && <span className="text-sm text-slate-400">/100</span>}
              </p>
              <p className="text-xs text-slate-500">across filtered incidents</p>
            </div>
          </div>

          {/* Filter bar */}
          <FilterBar filters={filters} onChange={setFilters} />

          {/* Operational metrics from AI computation */}
          {analytics?.metrics && analytics.metrics.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {analytics.metrics.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 p-4 shadow-sm"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">AI Metric</p>
                  <p className="mt-1.5 text-2xl font-extrabold text-indigo-900 tabular-nums">
                    {m.metricValue.toFixed(m.metricValue < 1 ? 2 : 1)}
                    {m.metricName.includes("hours") && <span className="text-sm font-normal text-indigo-500"> hrs</span>}
                  </p>
                  <p className="mt-0.5 text-xs font-medium capitalize text-indigo-700/70">
                    {fmt(m.metricName)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Main charts grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Area chart – incidents over time */}
            <ChartCard
              title="Incidents Over Time"
              subtitle={`Daily volume · ${timeSeries.length} data points`}
            >
              <AreaChart
                data={timeSeries}
                color="#6366f1"
                height={220}
                labelEvery={labelEvery}
              />
            </ChartCard>

            {/* Category breakdown */}
            <ChartCard
              title="Incidents by Category"
              subtitle="Filtered selection"
            >
              <HorizontalBarChart items={byCategory} />
            </ChartCard>

            {/* Incident status donut */}
            <ChartCard
              title="Incident Status Distribution"
              subtitle="Current status breakdown"
            >
              <DonutChart
                slices={byStatus}
                centerLabel="filtered"
                centerValue={filtered.length}
                size={200}
              />
            </ChartCard>

            {/* Case status donut */}
            <ChartCard
              title="Case Status Breakdown"
              subtitle="All case files"
            >
              <DonutChart
                slices={Object.entries(stats?.cases.byStatus ?? {}).map(([label, value]) => ({
                  label,
                  value: value as number,
                  color:
                    label === "CLOSED" ? "#22c55e" :
                    label === "OPEN" ? "#6366f1" :
                    label === "INVESTIGATING" ? "#f59e0b" :
                    label === "SUSPECT_ARRESTED" ? "#ef4444" :
                    label === "COLD_CASE" ? "#94a3b8" :
                    "#3b82f6",
                }))}
                centerLabel="cases"
                centerValue={stats?.cases.total ?? 0}
                size={200}
              />
            </ChartCard>
          </div>

          {/* Second row */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Users by role */}
            <ChartCard title="Users by Role" subtitle="All registered users">
              <HorizontalBarChart
                items={Object.entries(stats?.users.byRole ?? {}).map(([label, value]) => ({
                  label,
                  value: value as number,
                  color:
                    label === "SYSTEM_ADMIN" ? "#ef4444" :
                    label === "POLICE_COMMAND" ? "#8b5cf6" :
                    label === "POLICE_OFFICER" ? "#3b82f6" :
                    label === "VERIFIED_COMMUNITY_MEMBER" ? "#22c55e" :
                    label === "ENTERPRISE_SECURITY" ? "#f59e0b" :
                    "#94a3b8",
                }))}
              />
            </ChartCard>

            {/* Credibility distribution */}
            <ChartCard title="Credibility Score Distribution" subtitle="AI-assessed report quality">
              <HorizontalBarChart items={credBuckets} />
            </ChartCard>

            {/* Hotspot risk ranking */}
            <ChartCard
              title="Top Hotspot Zones"
              subtitle="Risk-ranked crime zones"
            >
              {analytics?.hotspots && analytics.hotspots.length > 0 ? (
                <div className="space-y-2.5">
                  {analytics.hotspots.slice(0, 6).map((h, i) => {
                    const riskColor =
                      h.riskScore > 70 ? "#ef4444" :
                      h.riskScore > 40 ? "#f97316" :
                      "#3b82f6";
                    return (
                      <div key={h.id} className="flex items-center gap-3">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-medium capitalize text-slate-700">
                            {h.crimeCategory?.toLowerCase().replace(/_/g, " ") ?? "Mixed crimes"}
                          </p>
                          <p className="text-[10px] text-slate-400">{h.incidentCount} incidents</p>
                        </div>
                        <div
                          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                          style={{ backgroundColor: riskColor + "18", color: riskColor }}
                        >
                          {Math.round(h.riskScore)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-slate-400 py-4 text-center">
                  No hotspot data. Click "Refresh Intelligence" to compute.
                </p>
              )}
            </ChartCard>
          </div>

          {/* Temporal heatmap – full width */}
          <ChartCard
            title="Crime Temporal Heatmap"
            subtitle="Weekly pattern intensity by hour of day"
          >
            <HeatGrid patterns={analytics?.patterns ?? []} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
