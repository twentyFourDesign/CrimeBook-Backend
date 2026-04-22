"use client";

import { useEffect, useRef } from "react";

export type BarItem = {
  label: string;
  value: number;
  color: string;
};

function fmt(s: string) {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function HorizontalBarChart({
  items,
  maxLabel = "Max",
}: {
  items: BarItem[];
  maxLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    barRefs.current.forEach((el, i) => {
      if (!el) return;
      const frac = items[i].value / max;
      // Trigger animation
      requestAnimationFrame(() => {
        el.style.width = `${Math.max(frac * 100, 2)}%`;
      });
    });
  }, [items, max]);

  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No data available</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items
        .filter((i) => i.value >= 0)
        .sort((a, b) => b.value - a.value)
        .map((item, idx) => (
          <div key={item.label} className="group flex items-center gap-3">
            <span className="w-36 flex-shrink-0 truncate text-right text-xs font-medium text-slate-600">
              {fmt(item.label)}
            </span>
            <div className="relative flex-1 h-6 rounded-md bg-slate-100">
              <div
                ref={(el) => { barRefs.current[idx] = el; }}
                className="absolute inset-y-0 left-0 rounded-md transition-all duration-700 ease-out"
                style={{
                  width: "0%",
                  background: `linear-gradient(90deg, ${item.color}cc, ${item.color})`,
                  boxShadow: `0 0 8px ${item.color}44`,
                  transitionDelay: `${idx * 60}ms`,
                }}
              />
            </div>
            <span className="w-10 flex-shrink-0 text-right text-xs font-bold tabular-nums text-slate-700">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
    </div>
  );
}

export function MiniBarChart({
  items,
  height = 80,
}: {
  items: { label: string; value: number; color?: string }[];
  height?: number;
}) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    barRefs.current.forEach((el, i) => {
      if (!el) return;
      const frac = items[i].value / max;
      requestAnimationFrame(() => {
        el.style.height = `${Math.max(frac * 100, 4)}%`;
      });
    });
  }, [items, max]);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {items.map((item, idx) => (
        <div key={item.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative w-full flex-1 flex items-end">
            <div
              ref={(el) => { barRefs.current[idx] = el; }}
              className="w-full rounded-t-sm transition-all duration-700 ease-out"
              style={{
                height: "4%",
                backgroundColor: item.color ?? "#6366f1",
                opacity: 0.85,
                transitionDelay: `${idx * 40}ms`,
              }}
              title={`${item.label}: ${item.value}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
