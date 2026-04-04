"use client";

import { useState } from "react";
import AdminCommunityVerificationsPage from "./community/page";
import AdminPoliceVerificationsPage from "./police/page";

const TABS = [
  { id: "community", label: "Community (Citizens)" },
  { id: "police", label: "Police Applications" },
] as const;

export default function UnifiedAdminVerificationsPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("community");

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">User Verifications</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage identity approvals for citizens and law enforcement onboarding.
          </p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
                ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "community" && <AdminCommunityVerificationsPage />}
        {activeTab === "police" && <AdminPoliceVerificationsPage />}
      </div>
    </div>
  );
}
