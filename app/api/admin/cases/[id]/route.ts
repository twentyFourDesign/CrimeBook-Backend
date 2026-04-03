import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { serializeCaseStatusHistory } from "@/src/lib/cases/status-history";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { error, user } = await requireUser(request);
    if (error || !user) {
      return fail(error ?? "Unauthorized", 401);
    }

    if (!requireRole(user, [UserRole.SYSTEM_ADMIN])) {
      return fail("Forbidden", 403);
    }

    const { id } = await context.params;

    const caseFile = await prisma.caseFile.findUnique({
      where: { id },
      include: {
        report: {
          include: {
            media: {
              orderBy: { createdAt: "asc" },
            },
            reporter: {
              select: {
                id: true,
                email: true,
                name: true,
                phone: true,
                role: true,
              },
            },
            reportMessages: {
              orderBy: { createdAt: "asc" },
              include: {
                sender: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                  },
                },
              },
            },
          },
        },
        evidence: {
          orderBy: { capturedAt: "desc" },
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                officerProfile: { select: { badgeNumber: true } },
              },
            },
          },
        },
        fieldNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            officer: {
              select: {
                id: true,
                name: true,
                email: true,
                officerProfile: { select: { badgeNumber: true } },
              },
            },
          },
        },
        suspects: {
          orderBy: { createdAt: "desc" },
        },
        assignments: {
          where: { removedAt: null },
          orderBy: [{ isLead: "desc" }, { assignedAt: "asc" }],
          include: {
            officer: {
              select: {
                id: true,
                name: true,
                email: true,
                officerProfile: { select: { badgeNumber: true, department: true, rank: true } },
              },
            },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!caseFile) {
      return fail("Case not found", 404);
    }

    const rep = caseFile.report;

    return ok("Case detail", {
      case: {
        id: caseFile.id,
        caseNumber: caseFile.caseNumber,
        status: caseFile.status,
        priority: caseFile.priority,
        notes: caseFile.notes,
        closedAt: caseFile.closedAt?.toISOString() ?? null,
        closureReason: caseFile.closureReason,
        createdAt: caseFile.createdAt.toISOString(),
        updatedAt: caseFile.updatedAt.toISOString(),
        report: {
          id: rep.id,
          crimeCategory: rep.crimeCategory,
          title: rep.title,
          description: rep.description,
          status: rep.status,
          visibility: rep.visibility,
          isAnonymous: rep.isAnonymous,
          latitude: rep.latitude,
          longitude: rep.longitude,
          locationAddress: rep.locationAddress,
          locationLabel: rep.locationLabel,
          locationPrecision: rep.locationPrecision,
          incidentTime: rep.incidentTime.toISOString(),
          isHappeningNow: rep.isHappeningNow,
          communityConfirmCount: rep.communityConfirmCount,
          isPoliceVerified: rep.isPoliceVerified,
          createdAt: rep.createdAt.toISOString(),
          reporter:
            rep.isAnonymous || !rep.reporter
              ? null
              : {
                  id: rep.reporter.id,
                  email: rep.reporter.email,
                  name: rep.reporter.name,
                  phone: rep.reporter.phone,
                  role: rep.reporter.role,
                },
          media: rep.media.map((m) => ({
            id: m.id,
            mediaType: m.mediaType,
            fileUrl: m.fileUrl,
            thumbnailUrl: m.thumbnailUrl,
            fileName: m.fileName,
            fileSizeBytes: m.fileSizeBytes,
            mimeType: m.mimeType,
            durationSecs: m.durationSecs,
            createdAt: m.createdAt.toISOString(),
          })),
          messages: rep.reportMessages.map((msg) => ({
            id: msg.id,
            body: msg.body,
            createdAt: msg.createdAt.toISOString(),
            sender: {
              id: msg.sender.id,
              name: msg.sender.name,
              email: msg.sender.email,
              role: msg.sender.role,
            },
          })),
        },
        evidence: caseFile.evidence.map((e) => ({
          id: e.id,
          evidenceType: e.evidenceType,
          fileUrl: e.fileUrl,
          fileName: e.fileName,
          fileSizeBytes: e.fileSizeBytes,
          description: e.description,
          capturedAt: e.capturedAt.toISOString(),
          createdAt: e.createdAt.toISOString(),
          uploadedBy: {
            name: e.uploadedBy.name,
            email: e.uploadedBy.email,
            role: e.uploadedBy.role,
            badgeNumber: e.uploadedBy.officerProfile?.badgeNumber ?? null,
          },
        })),
        fieldNotes: caseFile.fieldNotes.map((n) => ({
          id: n.id,
          content: n.content,
          noteType: n.noteType,
          createdAt: n.createdAt.toISOString(),
          officer: {
            name: n.officer.name,
            email: n.officer.email,
            badgeNumber: n.officer.officerProfile?.badgeNumber ?? null,
          },
        })),
        suspects: caseFile.suspects.map((s) => ({
          id: s.id,
          description: s.description,
          alias: s.alias,
          isArrested: s.isArrested,
          arrestedAt: s.arrestedAt?.toISOString() ?? null,
          photoUrl: s.photoUrl,
          idNumber: s.idNumber,
          previousRecords: s.previousRecords,
          createdAt: s.createdAt.toISOString(),
        })),
        assignments: caseFile.assignments.map((a) => ({
          id: a.id,
          isLead: a.isLead,
          assignedAt: a.assignedAt.toISOString(),
          officer: {
            name: a.officer.name,
            email: a.officer.email,
            badgeNumber: a.officer.officerProfile?.badgeNumber ?? null,
            department: a.officer.officerProfile?.department ?? null,
            rank: a.officer.officerProfile?.rank ?? null,
          },
        })),
        caseStatusHistory: serializeCaseStatusHistory(caseFile.statusHistory),
      },
    });
  } catch (e) {
    console.error("[admin/cases/id]", e);
    return fail(e instanceof Error ? e.message : "Failed to load case", 500);
  }
}
