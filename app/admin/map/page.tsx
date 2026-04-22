"use client";

import { IncidentMap } from "./IncidentMap";

export default function AdminMapPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Incident map</h1>
        <p className="mt-1 text-sm text-slate-600">
        </p>
      </div>
      <IncidentMap />
    </div>
  );
}
