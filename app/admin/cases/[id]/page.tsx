"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAdminSession } from "../../_lib/admin-session";

function fmt(s: string) {
  return s.replace(/_/g, " ");
}

type CaseDetail = {
  id: string;
  caseNumber: string;
  status: string;
  priority: number;
  notes: string | null;
  closedAt: string | null;
  closureReason: string | null;
  createdAt: string;
  updatedAt: string;
  report: {
    id: string;
    crimeCategory: string;
    title: string | null;
    description: string;
    status: string;
    visibility: string;
    isAnonymous: boolean;
    latitude: number;
    longitude: number;
    locationAddress: string | null;
    locationLabel: string | null;
    locationPrecision: string;
    incidentTime: string;
    isHappeningNow: boolean;
    communityConfirmCount: number;
    isPoliceVerified: boolean;
    createdAt: string;
    reporter: {
      id: string;
      email: string;
      name: string;
      phone: string | null;
      role: string;
    } | null;
    media: {
      id: string;
      mediaType: string;
      fileUrl: string;
      thumbnailUrl: string | null;
      fileName: string;
      mimeType: string;
      createdAt: string;
    }[];
    messages: {
      id: string;
      body: string;
      createdAt: string;
      sender: { name: string; email: string; role: string };
    }[];
  };
  evidence: {
    id: string;
    evidenceType: string;
    fileUrl: string;
    fileName: string;
    fileSizeBytes: number;
    description: string | null;
    capturedAt: string;
    createdAt: string;
    uploadedBy: { name: string; email: string; role: string; badgeNumber: string | null };
  }[];
  fieldNotes: {
    id: string;
    content: string;
    noteType: string;
    createdAt: string;
    officer: { name: string; email: string; badgeNumber: string | null };
  }[];
  suspects: {
    id: string;
    description: string;
    alias: string | null;
    isArrested: boolean;
    arrestedAt: string | null;
    photoUrl: string | null;
    idNumber: string | null;
    previousRecords: string | null;
    createdAt: string;
  }[];
  assignments: {
    id: string;
    isLead: boolean;
    assignedAt: string;
    officer: {
      name: string;
      email: string;
      badgeNumber: string | null;
      department: string | null;
      rank: string | null;
    };
  }[];
};

type ApiOk<T> = { success: true; message: string; data: T };
type ApiErr = { success: false; message: string };

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AdminCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const { accessToken, authHeaders } = useAdminSession();
  const [data, setData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken || !id) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cases/${id}`, { headers: authHeaders() });
      const payload = (await res.json()) as ApiOk<{ case: CaseDetail }> | ApiErr;
      if (!res.ok || !payload.success) {
        throw new Error("message" in payload ? payload.message : "Failed to load case");
      }
      setData(payload.data.case);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!id) {
    return <p className="text-sm text-slate-600">Invalid case ID.</p>;
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading case…</p>;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/cases" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to cases
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      </div>
    );
  }

  const rep = data.report;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${rep.latitude},${rep.longitude}`;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/cases" className="text-sm font-medium text-blue-600 hover:underline">
            ← All cases
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{data.caseNumber}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Case status: <span className="font-medium text-slate-900">{fmt(data.status)}</span> · Priority{" "}
            {data.priority}
          </p>
          <p className="text-xs text-slate-500">
            Opened {new Date(data.createdAt).toLocaleString()} · Updated {new Date(data.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right text-xs text-slate-600">
          Report ID
          <p className="font-mono text-sm text-slate-900">{rep.id.slice(0, 8)}…</p>
        </div>
      </div>

      {data.closedAt ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="font-medium text-slate-800">Closed</span> {new Date(data.closedAt).toLocaleString()}
          {data.closureReason ? (
            <p className="mt-1 text-slate-600">{data.closureReason}</p>
          ) : null}
        </div>
      ) : null}

      {data.notes ? (
        <Section title="Case notes (internal)">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{data.notes}</p>
        </Section>
      ) : null}

      <Section title="Incident report (citizen)">
        <div className="space-y-3 text-sm">
          <p>
            <span className="text-slate-500">Category:</span> {fmt(rep.crimeCategory)}
          </p>
          {rep.title ? (
            <p className="font-medium text-slate-900">{rep.title}</p>
          ) : null}
          <p className="whitespace-pre-wrap text-slate-800">{rep.description}</p>
          <div className="flex flex-wrap gap-4 text-slate-600">
            <span>Visibility: {fmt(rep.visibility)}</span>
            <span>Report status: {fmt(rep.status)}</span>
            <span>Confirms: {rep.communityConfirmCount}</span>
          </div>
          <p>
            <span className="text-slate-500">When:</span> {new Date(rep.incidentTime).toLocaleString()}
            {rep.isHappeningNow ? " · Happening now" : ""}
          </p>
          <p>
            <span className="text-slate-500">Where:</span> {rep.locationLabel || rep.locationAddress || "—"}{" "}
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="ml-1 text-blue-600 hover:underline">
              Open in Maps
            </a>
          </p>
          <p className="text-xs text-slate-500">
            Coordinates: {rep.latitude.toFixed(5)}, {rep.longitude.toFixed(5)} · Precision: {rep.locationPrecision}
          </p>
        </div>
      </Section>

      <Section title="Reporter">
        {rep.isAnonymous || !rep.reporter ? (
          <p className="text-sm text-slate-600">Anonymous or no linked account.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-800">
            <li>
              <span className="text-slate-500">Name:</span> {rep.reporter.name}
            </li>
            <li>
              <span className="text-slate-500">Email:</span> {rep.reporter.email}
            </li>
            {rep.reporter.phone ? (
              <li>
                <span className="text-slate-500">Phone:</span> {rep.reporter.phone}
              </li>
            ) : null}
            <li>
              <span className="text-slate-500">Role:</span> {fmt(rep.reporter.role)}
            </li>
          </ul>
        )}
      </Section>

      <Section title={`Citizen uploads (${rep.media.length})`}>
        {rep.media.length === 0 ? (
          <p className="text-sm text-slate-500">No media attached.</p>
        ) : (
          <ul className="space-y-2">
            {rep.media.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-900">{m.fileName}</span>
                <span className="text-xs text-slate-500">
                  {fmt(m.mediaType)} · {new Date(m.createdAt).toLocaleString()}
                </span>
                <a
                  href={m.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Open file
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Assigned officers (${data.assignments.length})`}>
        {data.assignments.length === 0 ? (
          <p className="text-sm text-slate-500">No assignments.</p>
        ) : (
          <ul className="space-y-3">
            {data.assignments.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                <p className="font-medium text-slate-900">
                  {a.officer.name}
                  {a.isLead ? (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-800">
                      Lead
                    </span>
                  ) : null}
                </p>
                <p className="text-slate-600">{a.officer.email}</p>
                <p className="text-xs text-slate-500">
                  {[a.officer.badgeNumber, a.officer.rank, a.officer.department].filter(Boolean).join(" · ") ||
                    "—"}
                </p>
                <p className="text-xs text-slate-400">Since {new Date(a.assignedAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Police evidence (${data.evidence.length})`}>
        {data.evidence.length === 0 ? (
          <p className="text-sm text-slate-500">No evidence uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {data.evidence.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{e.fileName}</span>
                  <span className="text-xs text-slate-500">{fmt(e.evidenceType)}</span>
                </div>
                <p className="text-xs text-slate-500">
                  By {e.uploadedBy.name}
                  {e.uploadedBy.badgeNumber ? ` · Badge ${e.uploadedBy.badgeNumber}` : ""} ·{" "}
                  {new Date(e.capturedAt).toLocaleString()}
                </p>
                {e.description ? <p className="mt-1 text-slate-700">{e.description}</p> : null}
                <a href={e.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                  Open file
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Field notes (${data.fieldNotes.length})`}>
        {data.fieldNotes.length === 0 ? (
          <p className="text-sm text-slate-500">No notes.</p>
        ) : (
          <ul className="space-y-4">
            {data.fieldNotes.map((n) => (
              <li key={n.id} className="border-l-2 border-blue-200 pl-4">
                <p className="text-xs font-medium text-slate-500">
                  {n.officer.name}
                  {n.officer.badgeNumber ? ` · ${n.officer.badgeNumber}` : ""} · {fmt(n.noteType)} ·{" "}
                  {new Date(n.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{n.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Suspects (${data.suspects.length})`}>
        {data.suspects.length === 0 ? (
          <p className="text-sm text-slate-500">No suspect records.</p>
        ) : (
          <ul className="space-y-3">
            {data.suspects.map((s) => (
              <li key={s.id} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap text-slate-900">{s.description}</p>
                {s.alias ? <p className="text-slate-600">Alias: {s.alias}</p> : null}
                {s.isArrested ? (
                  <p className="text-xs text-emerald-700">Arrested {s.arrestedAt ? new Date(s.arrestedAt).toLocaleString() : ""}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Reporter ↔ officer messages (${rep.messages.length})`}>
        {rep.messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages on this thread.</p>
        ) : (
          <ul className="space-y-3">
            {rep.messages.map((m) => (
              <li key={m.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <p className="text-xs text-slate-500">
                  {m.sender.name} ({fmt(m.sender.role)}) · {new Date(m.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
