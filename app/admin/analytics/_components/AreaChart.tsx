"use client";

import { useEffect, useRef, useState } from "react";

export type DataPoint = {
  label: string;
  value: number;
};

function smoothPath(
  points: { x: number; y: number }[],
  width: number,
  height: number,
  padding: number
): { line: string; area: string } {
  if (points.length < 2) return { line: "", area: "" };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const yRange = maxY - minY || 1;
  const xRange = Math.max(...xs) - Math.min(...xs) || 1;

  const drawH = height - padding * 2;
  const drawW = width - padding * 2;

  const mapped = points.map((p) => ({
    px: padding + ((p.x - Math.min(...xs)) / xRange) * drawW,
    py: padding + drawH - ((p.y - minY) / yRange) * drawH,
  }));

  let line = `M ${mapped[0].px} ${mapped[0].py}`;
  for (let i = 1; i < mapped.length; i++) {
    const cp1x = mapped[i - 1].px + (mapped[i].px - mapped[i - 1].px) * 0.4;
    const cp1y = mapped[i - 1].py;
    const cp2x = mapped[i].px - (mapped[i].px - mapped[i - 1].px) * 0.4;
    const cp2y = mapped[i].py;
    line += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${mapped[i].px},${mapped[i].py}`;
  }

  const area =
    line +
    ` L ${mapped[mapped.length - 1].px},${padding + drawH}` +
    ` L ${mapped[0].px},${padding + drawH} Z`;

  return { line, area };
}

export function AreaChart({
  data,
  color = "#6366f1",
  height = 200,
  showLabels = true,
  labelEvery = 1,
}: {
  data: DataPoint[];
  color?: string;
  height?: number;
  showLabels?: boolean;
  labelEvery?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const [svgW, setSvgW] = useState(600);
  const padding = 32;
  const id = useRef(`ac-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      setSvgW(entries[0].contentRect.width || 600);
    });
    if (svgRef.current) obs.observe(svgRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!lineRef.current) return;
    const len = lineRef.current.getTotalLength?.() ?? 1000;
    lineRef.current.style.strokeDasharray = `${len}`;
    lineRef.current.style.strokeDashoffset = `${len}`;
    requestAnimationFrame(() => {
      if (!lineRef.current) return;
      lineRef.current.style.transition = "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)";
      lineRef.current.style.strokeDashoffset = "0";
    });
  }, [data, svgW]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg bg-slate-50 text-sm text-slate-400"
        style={{ height }}
      >
        No data for this period
      </div>
    );
  }

  const points = data.map((d, i) => ({ x: i, y: d.value }));
  const { line, area } = smoothPath(points, svgW, height - (showLabels ? 24 : 0), padding);
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  // Y gridlines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: padding + (height - (showLabels ? 24 : 0) - padding * 2) * (1 - frac),
    label: Math.round(maxVal * frac).toString(),
  }));

  return (
    <svg
      ref={svgRef}
      width="100%"
      height={height}
      viewBox={`0 0 ${svgW} ${height}`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="50%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {gridLines.map((g) => (
        <g key={g.y}>
          <line
            x1={padding}
            y1={g.y}
            x2={svgW - padding}
            y2={g.y}
            stroke="#e2e8f0"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          <text x={padding - 6} y={g.y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
            {g.label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      {area && (
        <path d={area} fill={`url(#${id}-fill)`} />
      )}

      {/* Line */}
      {line && (
        <path
          ref={lineRef}
          d={line}
          fill="none"
          stroke={`url(#${id}-stroke)`}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Data dots on hover + x labels */}
      {data.map((d, i) => {
        const mapped = points.map((p) => {
          const xs = points.map((p) => p.x);
          const ys = points.map((p) => p.y);
          const minY2 = Math.min(...ys);
          const maxY2 = Math.max(...ys);
          const yRange2 = maxY2 - minY2 || 1;
          const xRange2 = Math.max(...xs) - Math.min(...xs) || 1;
          const drawH2 = height - (showLabels ? 24 : 0) - padding * 2;
          const drawW2 = svgW - padding * 2;
          return {
            px: padding + ((p.x - Math.min(...xs)) / xRange2) * drawW2,
            py: padding + drawH2 - ((p.y - minY2) / yRange2) * drawH2,
          };
        });
        const pt = mapped[i];
        const showLabel = i % labelEvery === 0;
        return (
          <g key={i}>
            <circle
              cx={pt.px}
              cy={pt.py}
              r={4}
              fill={color}
              fillOpacity={0.9}
              stroke="white"
              strokeWidth={2}
              className="opacity-0 hover:opacity-100 transition-opacity"
            />
            <title>{`${d.label}: ${d.value}`}</title>
            {showLabels && showLabel && (
              <text
                x={pt.px}
                y={height - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
