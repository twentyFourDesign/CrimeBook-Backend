"use client";

import { useState } from "react";

export const CATEGORY_COLORS: Record<string, string> = {
  ROBBERY: "#ef4444",
  ASSAULT: "#f97316",
  KIDNAPPING: "#8b5cf6",
  DOMESTIC_VIOLENCE: "#ec4899",
  FRAUD: "#f59e0b",
  MISSING_PERSON: "#3b82f6",
  SUSPICIOUS_ACTIVITY: "#6366f1",
  VANDALISM: "#84cc16",
  DRUG_ACTIVITY: "#14b8a6",
  TRAFFIC_CRIME: "#64748b",
  OTHER: "#94a3b8",
};

export const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: "#6366f1",
  COMMUNITY_CONFIRMED: "#3b82f6",
  POLICE_VERIFIED: "#0ea5e9",
  UNDER_INVESTIGATION: "#f59e0b",
  POLICE_RESOLVED: "#84cc16",
  RESOLVED: "#22c55e",
  REJECTED: "#ef4444",
  ARCHIVED: "#94a3b8",
};

const ALL_CATEGORIES = [
  "ROBBERY", "ASSAULT", "KIDNAPPING", "DOMESTIC_VIOLENCE", "FRAUD",
  "MISSING_PERSON", "SUSPICIOUS_ACTIVITY", "VANDALISM", "DRUG_ACTIVITY",
  "TRAFFIC_CRIME", "OTHER",
];

const ALL_STATUSES = [
  "SUBMITTED", "COMMUNITY_CONFIRMED", "POLICE_VERIFIED",
  "UNDER_INVESTIGATION", "POLICE_RESOLVED", "RESOLVED", "REJECTED", "ARCHIVED",
];

export type TimeRange = "7d" | "30d" | "90d" | "1y" | "all";
export type Filters = {
  timeRange: TimeRange;
  categories: string[];
  statuses: string[];
};

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "1 year", value: "1y" },
  { label: "All time", value: "all" },
];

function fmt(s: string) {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  const [catOpen, setCatOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const toggleCat = (c: string) => {
    const next = filters.categories.includes(c)
      ? filters.categories.filter((x) => x !== c)
      : [...filters.categories, c];
    onChange({ ...filters, categories: next });
  };

  const toggleStatus = (s: string) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    onChange({ ...filters, statuses: next });
  };

  const clearAll = () =>
    onChange({ timeRange: "all", categories: [], statuses: [] });

  const activeCount =
    (filters.categories.length > 0 ? 1 : 0) +
    (filters.statuses.length > 0 ? 1 : 0) +
    (filters.timeRange !== "all" ? 1 : 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm backdrop-blur-sm lg:p-4">
      <div className="flex flex-wrap items-center gap-2 lg:gap-3">
        {/* Time range */}
        <div className="flex w-full items-center gap-1 sm:w-auto">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Period
          </span>
          <div className="flex flex-1 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 sm:flex-none">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.value}
                type="button"
                className={`flex-1 px-2.5 py-1.5 text-[10px] font-bold transition-all duration-150 sm:flex-none sm:px-3 sm:text-xs ${
                  filters.timeRange === tr.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                }`}
                onClick={() => onChange({ ...filters, timeRange: tr.value })}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden h-5 w-px bg-slate-200 sm:block" />

        {/* Category picker */}
        <div className="relative flex-1 sm:flex-none">
          <button
            type="button"
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 px-3 py-2 text-xs font-semibold transition-all duration-150 sm:w-auto sm:py-1.5 ${
              filters.categories.length > 0
                ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => { setCatOpen((v) => !v); setStatusOpen(false); }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Categories
            {filters.categories.length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                {filters.categories.length}
              </span>
            )}
          </button>
          {catOpen && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:w-64">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Filter by category</span>
                {filters.categories.length > 0 && (
                  <button
                    className="text-[10px] font-medium text-indigo-600 hover:underline"
                    onClick={() => onChange({ ...filters, categories: [] })}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((c) => {
                  const active = filters.categories.includes(c);
                  const color = CATEGORY_COLORS[c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCat(c)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                        active ? "shadow-sm" : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                      }`}
                      style={
                        active
                          ? { backgroundColor: color + "18", borderColor: color + "44", color }
                          : {}
                      }
                    >
                      {fmt(c)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Status picker */}
        <div className="relative flex-1 sm:flex-none">
          <button
            type="button"
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 px-3 py-2 text-xs font-semibold transition-all duration-150 sm:w-auto sm:py-1.5 ${
              filters.statuses.length > 0
                ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => { setStatusOpen((v) => !v); setCatOpen(false); }}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Status
            {filters.statuses.length > 0 && (
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                {filters.statuses.length}
              </span>
            )}
          </button>
          {statusOpen && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-slate-200 bg-white p-3 shadow-xl sm:w-64">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">Filter by status</span>
                {filters.statuses.length > 0 && (
                  <button
                    className="text-[10px] font-medium text-violet-600 hover:underline"
                    onClick={() => onChange({ ...filters, statuses: [] })}
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1">
                {ALL_STATUSES.map((s) => {
                  const active = filters.statuses.includes(s);
                  const color = STATUS_COLORS[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all ${
                        active ? "shadow-sm" : "text-slate-600 hover:bg-slate-50"
                      }`}
                      style={active ? { backgroundColor: color + "12", color } : {}}
                    >
                      <span
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {fmt(s)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-red-500 transition-colors hover:bg-red-50"
            onClick={clearAll}
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear ({activeCount})
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {filters.categories.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2.5">
          {filters.categories.map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{
                backgroundColor: CATEGORY_COLORS[c] + "18",
                color: CATEGORY_COLORS[c],
                border: `1px solid ${CATEGORY_COLORS[c]}33`,
              }}
            >
              {fmt(c)}
              <button onClick={() => toggleCat(c)} className="ml-1 opacity-60 hover:opacity-100">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
