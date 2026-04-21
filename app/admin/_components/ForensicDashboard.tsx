import React from "react";

export interface ForensicSignal {
  label: string;
  score: number;
  detail: string;
}

export interface ForensicAnalysis {
  finalScore: number;
  grade: string;
  gradeColor: string;
  signals: Record<string, ForensicSignal>;
  allFlags: string[];
  reportHash: string;
}

export function ForensicDashboard({ analysis }: { analysis: ForensicAnalysis }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center py-4">
        {/* Score Ring */}
        <div 
          className="flex h-32 w-32 items-center justify-center rounded-full border-4 shadow-sm"
          style={{ borderColor: analysis.gradeColor }}
        >
          <div className="text-center">
            <div className="flex items-baseline justify-center">
              <span className="text-4xl font-black" style={{ color: analysis.gradeColor }}>
                {analysis.finalScore}
              </span>
              <span className="mx-1 text-slate-300 font-bold">/</span>
              <span className="text-slate-400 font-bold">100</span>
            </div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: analysis.gradeColor }}>
              {analysis.grade}
            </div>
          </div>
        </div>
      </div>

      {/* Signals Breakdown */}
      <div>
        <h3 className="mb-4 text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">
          SIGNAL ANALYSIS BREAKDOWN
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(analysis.signals).map((sig) => (
            <div key={sig.label} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">{sig.label}</span>
                <span 
                  className="text-xs font-black"
                  style={{ color: sig.score >= 70 ? "#059669" : sig.score >= 40 ? "#D97706" : "#DC2626" }}
                >
                  {sig.score}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div 
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ 
                    width: `${sig.score}%`, 
                    backgroundColor: sig.score >= 70 ? "#059669" : sig.score >= 40 ? "#D97706" : "#DC2626" 
                  }}
                />
              </div>
              <p className="mt-2 font-mono text-[9px] text-slate-400 leading-tight">
                {sig.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Flags */}
      <div>
        <h3 className="mb-3 text-[10px] font-bold tracking-[0.15em] text-slate-400 uppercase">
          FORENSIC FLAGS
        </h3>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {analysis.allFlags.map((flag) => (
            <span 
              key={flag} 
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-600 shadow-sm"
            >
              {flag}
            </span>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 text-center">
        <p className="font-mono text-[9px] text-slate-300">
          REPORT_HASH: {analysis.reportHash} • ENGINE: neural_forensics_v4.2
        </p>
      </div>
    </div>
  );
}
