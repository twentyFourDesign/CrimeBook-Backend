import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { serializeReportStatusHistory } from "@/src/lib/reports/status-history";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id } = await context.params;

  const report = await prisma.incidentReport.findFirst({
    where: {
      id,
      reporterId: user.id,
    },
    select: {
      id: true,
      caseId: true,
      crimeCategory: true,
      title: true,
      description: true,
      status: true,
      visibility: true,
      isAnonymous: true,
      latitude: true,
      longitude: true,
      locationAddress: true,
      locationLabel: true,
      locationPrecision: true,
      incidentTime: true,
      isHappeningNow: true,
      communityConfirmCount: true,
      isPoliceVerified: true,
      createdAt: true,
      updatedAt: true,
      authenticityAnalysis: true,
      media: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          mediaType: true,
          fileUrl: true,
          thumbnailUrl: true,
          fileName: true,
          fileSizeBytes: true,
          mimeType: true,
          durationSecs: true,
          createdAt: true,
        },
      },
      caseFile: {
        select: {
          assignments: {
            where: { removedAt: null },
            orderBy: [{ isLead: "desc" }, { assignedAt: "asc" }],
            take: 1,
            select: {
              officer: {
                select: {
                  name: true,
                  officerProfile: { select: { badgeNumber: true } },
                },
              },
            },
          },
          suspects: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              description: true,
              alias: true,
              createdAt: true,
            },
          },
          fieldNotes: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true,
              content: true,
              noteType: true,
              createdAt: true,
              officer: {
                select: {
                  name: true,
                },
              },
            },
          },
          evidence: {
            orderBy: { capturedAt: "asc" },
            select: {
              id: true,
              fileUrl: true,
              fileName: true,
              evidenceType: true,
              capturedAt: true,
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!report) {
    return fail("Report not found", 404);
  }

  return ok("Report", {
    report: {
      id: report.id,
      caseId: report.caseId,
      crimeCategory: report.crimeCategory,
      title: report.title,
      description: report.description,
      status: report.status,
      visibility: report.visibility,
      isAnonymous: report.isAnonymous,
      latitude: report.latitude,
      longitude: report.longitude,
      locationAddress: report.locationAddress,
      locationLabel: report.locationLabel,
      locationPrecision: report.locationPrecision,
      incidentTime: report.incidentTime.toISOString(),
      isHappeningNow: report.isHappeningNow,
      communityConfirmCount: report.communityConfirmCount,
      isPoliceVerified: report.isPoliceVerified,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      media: report.media.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      assignedOfficer: report.caseFile?.assignments[0]
        ? {
            name: report.caseFile.assignments[0].officer.name,
            badgeNumber: report.caseFile.assignments[0].officer.officerProfile?.badgeNumber ?? null,
          }
        : null,
      suspectTags:
        report.caseFile?.suspects.map((s) => ({
          id: s.id,
          description: s.description,
          alias: s.alias,
          createdAt: s.createdAt.toISOString(),
        })) ?? [],
      policeNotes:
        report.caseFile?.fieldNotes.map((n) => ({
          id: n.id,
          content: n.content,
          noteType: n.noteType,
          officerName: n.officer.name,
          createdAt: n.createdAt.toISOString(),
        })) ?? [],
      policeMedia:
        report.caseFile?.evidence.map((e) => ({
          id: e.id,
          fileUrl: e.fileUrl,
          fileName: e.fileName,
          evidenceType: e.evidenceType,
          capturedAt: e.capturedAt.toISOString(),
        })) ?? [],
      statusHistory: serializeReportStatusHistory(report.statusHistory),
      authenticityAnalysis: report.authenticityAnalysis ?? null,
    },
  });
}
