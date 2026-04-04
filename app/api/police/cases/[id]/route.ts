import { NextRequest } from "next/server";
import { CaseStatus, ReportStatus } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { recordCaseStatusChange } from "@/src/lib/cases/status-history";
import { recordReportStatusChange } from "@/src/lib/reports/status-history";

type RouteContext = { params: Promise<{ id: string }> };

async function requireAssignedCase(caseId: string, officerId: string) {
  const caseFile = await prisma.caseFile.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseNumber: true,
      status: true,
      reportId: true,
      assignments: {
        where: { officerId, removedAt: null },
        select: { id: true },
      },
    },
  });
  if (!caseFile) return { error: fail("Case not found", 404), caseFile: null };
  if (!caseFile.assignments.length) {
    return { error: fail("You are not assigned to this case", 403), caseFile: null };
  }
  return { error: null, caseFile };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }
  if (user.role !== "POLICE_OFFICER" && user.role !== "POLICE_COMMAND") {
    return fail("Forbidden", 403);
  }

  const { id } = await context.params;
  const assigned = await requireAssignedCase(id, user.id);
  if (assigned.error) return assigned.error;
  const cf = assigned.caseFile!;

  return ok("Case", {
    case: {
      id: cf.id,
      caseNumber: cf.caseNumber,
      status: cf.status,
      reportId: cf.reportId,
    },
  });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }
  if (user.role !== "POLICE_OFFICER" && user.role !== "POLICE_COMMAND") {
    return fail("Forbidden", 403);
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }
  if (typeof body !== "object" || body === null) {
    return fail("Invalid body", 400);
  }
  const { status: statusRaw } = body as { status?: unknown };
  if (typeof statusRaw !== "string") {
    return fail("status is required", 400);
  }

  if (!Object.values(CaseStatus).includes(statusRaw as CaseStatus)) {
    return fail("Invalid case status", 400);
  }
  const status = statusRaw as CaseStatus;

  const assigned = await requireAssignedCase(id, user.id);
  if (assigned.error) return assigned.error;
  const cf = assigned.caseFile!;

  const linkedReport = await prisma.incidentReport.findUnique({
    where: { id: cf.reportId },
    select: { id: true, status: true },
  });
  if (!linkedReport) {
    return fail("Report not found", 404);
  }

  let nextReportStatus: ReportStatus | null = null;
  if (status === CaseStatus.CLOSED) {
    nextReportStatus = "POLICE_RESOLVED" as ReportStatus;
  } else if (status === CaseStatus.SUSPECT_DETAINED || status === CaseStatus.SUSPECT_ARRESTED) {
    if (linkedReport.status !== ReportStatus.RESOLVED) {
      nextReportStatus = ReportStatus.UNDER_INVESTIGATION;
    }
  } else if (
    status === CaseStatus.RESPONDING ||
    status === CaseStatus.INVESTIGATING ||
    status === CaseStatus.OPEN
  ) {
    if (linkedReport.status !== ReportStatus.RESOLVED) {
      nextReportStatus = ReportStatus.UNDER_INVESTIGATION;
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.caseFile.update({
      where: { id: cf.id },
      data: { status },
    });

    if (cf.status !== status) {
      await recordCaseStatusChange({
        caseId: cf.id,
        fromStatus: cf.status,
        toStatus: status,
        changedById: user.id,
        notes: null,
        tx,
      });
    }

    if (nextReportStatus !== null && nextReportStatus !== linkedReport.status) {
      await recordReportStatusChange({
        reportId: linkedReport.id,
        fromStatus: linkedReport.status,
        toStatus: nextReportStatus,
        changedById: user.id,
        notes: `Case status: ${status}`,
        tx,
      });
      await tx.incidentReport.update({
        where: { id: linkedReport.id },
        data: { status: nextReportStatus },
      });
    }

    if (status === CaseStatus.CLOSED) {
      // Award officer badges
      const { awardBadgeIfEligible } = await import("@/src/lib/gamification/badges");
      const solvedCount = await tx.caseFile.count({
        where: {
          assignments: { some: { officerId: user.id } },
          status: CaseStatus.CLOSED,
        },
      });

      if (solvedCount === 1) {
        await awardBadgeIfEligible(user.id, "SOLVED_1_CASE");
      } else if (solvedCount === 10) {
        await awardBadgeIfEligible(user.id, "SOLVED_10_CASES");
      }
    }
  });

  return ok("Case updated", {
    case: {
      id: cf.id,
      status,
    },
  });
}
