"use client";

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type PatternRow = {
  crimeCategory: string;
  dayOfWeek: number;
  hourOfDay: number;
  avgIncidentCount: number;
};

function interpolateColor(intensity: number): string {
  // 0 → cool blue-grey, 1 → hot red-orange
  const stops = [
    { t: 0,    r: 241, g: 245, b: 249 }, // slate-100
    { t: 0.25, r: 199, g: 210, b: 254 }, // indigo-200
    { t: 0.5,  r: 129, g: 140, b: 248 }, // indigo-400
    { t: 0.75, r: 249, g: 115, b: 22  }, // orange-500
    { t: 1,    r: 239, g: 68,  b: 68  }, // red-500
  ];
  const i = intensity;
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let j = 0; j < stops.length - 1; j++) {
    if (i >= stops[j].t && i <= stops[j + 1].t) {
      lo = stops[j];
      hi = stops[j + 1];
      break;
    }
  }
  const t2 = (i - lo.t) / (hi.t - lo.t || 1);
  const r = Math.round(lo.r + (hi.r - lo.r) * t2);
  const g = Math.round(lo.g + (hi.g - lo.g) * t2);
  const b = Math.round(lo.b + (hi.b - lo.b) * t2);
  return `rgb(${r},${g},${b})`;
}

export function HeatGrid({
  patterns,
}: {
  patterns: PatternRow[];
}) {
  if (patterns.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-slate-400">
        No temporal pattern data — run "Refresh Intelligence" first.
      </div>
    );
  }

  // Build 7×24 grid summing avgIncidentCount
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  let maxVal = 0;

  for (const p of patterns) {
    if (p.dayOfWeek >= 0 && p.dayOfWeek < 7 && p.hourOfDay >= 0 && p.hourOfDay < 24) {
      grid[p.dayOfWeek][p.hourOfDay] += p.avgIncidentCount;
      if (grid[p.dayOfWeek][p.hourOfDay] > maxVal) maxVal = grid[p.dayOfWeek][p.hourOfDay];
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour labels */}
        <div className="flex">
          <div className="w-10 flex-shrink-0" />
          {hours.map((h) => (
            <div
              key={h}
              className="flex-1 text-center text-[9px] text-slate-400"
            >
              {h % 4 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS_SHORT.map((day, di) => (
          <div key={day} className="flex items-center gap-0.5 mb-0.5">
            <div className="w-10 flex-shrink-0 text-right pr-2 text-[10px] font-medium text-slate-500">
              {day}
            </div>
            {hours.map((h) => {
              const val = grid[di][h];
              const intensity = maxVal > 0 ? val / maxVal : 0;
              const bg = interpolateColor(intensity);
              const textColor = intensity > 0.6 ? "#fff" : "#94a3b8";
              return (
                <div
                  key={h}
                  className="flex-1 aspect-square rounded-[3px] flex items-center justify-center cursor-default transition-all duration-200 hover:scale-110 hover:z-10 hover:ring-2 hover:ring-white/80"
                  style={{ backgroundColor: bg }}
                  title={`${day} ${h}:00 — ${val.toFixed(1)} avg incidents`}
                >
                  {val > 0 && intensity > 0.5 && (
                    <span className="text-[8px] font-bold" style={{ color: textColor }}>
                      {Math.round(val)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Color scale legend */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Low</span>
          <div className="h-2 flex-1 max-w-[200px] rounded-full overflow-hidden">
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(90deg, #f1f5f9, #c7d2fe, #818cf8, #f97316, #ef4444)",
              }}
            />
          </div>
          <span className="text-[10px] text-slate-400">High</span>
        </div>
      </div>
    </div>
  );
}
