"use client";

import { useEffect, useRef } from "react";

export type DonutSlice = {
  label: string;
  value: number;
  color: string;
};

function fmt(s: string) {
  return s.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  size = 180,
}: {
  slices: DonutSlice[];
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0);
  const r = 70;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const strokeWidth = 28;
  const pathRefs = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    pathRefs.current.forEach((el, i) => {
      if (!el) return;
      const frac = total > 0 ? slices[i].value / total : 0;
      const dash = frac * circumference;
      el.style.strokeDasharray = `${dash} ${circumference}`;
      el.style.transition = `stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1) ${i * 80}ms`;
    });
  }, [slices, total, circumference]);

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-full border-[28px] border-slate-100 text-sm text-slate-400"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }

  let offset = -circumference / 4; // Start at top
  const arcs: { dashOffset: number; dashArray: string; color: string }[] = [];

  for (const slice of slices) {
    const frac = slice.value / total;
    const dash = frac * circumference;
    arcs.push({ dashOffset: offset, dashArray: `${dash} ${circumference}`, color: slice.color });
    offset -= dash;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Background ring */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {arcs.map((arc, i) => (
            <circle
              key={i}
              ref={(el) => { pathRefs.current[i] = el; }}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray="0 999"
              strokeDashoffset={arc.dashOffset}
              strokeLinecap="round"
              style={{ transition: `stroke-dasharray 0.8s ease ${i * 80}ms` }}
            />
          ))}
        </svg>
        {/* Center text */}
        {centerValue !== undefined && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{centerValue}</span>
            {centerLabel && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2 min-w-0">
        {slices
          .filter((s) => s.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="truncate text-xs text-slate-600">{fmt(s.label)}</span>
              <span className="ml-auto pl-2 text-xs font-bold tabular-nums text-slate-900">
                {s.value}
              </span>
              <span className="text-[10px] text-slate-400 w-8 text-right">
                {total > 0 ? Math.round((s.value / total) * 100) : 0}%
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
