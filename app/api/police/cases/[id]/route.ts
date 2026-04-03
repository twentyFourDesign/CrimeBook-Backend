import { NextRequest } from "next/server";
import { CaseStatus, ReportStatus } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

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

  await prisma.$transaction(async (tx) => {
    await tx.caseFile.update({
      where: { id: cf.id },
      data: { status },
    });

    if (status === CaseStatus.CLOSED) {
      await tx.incidentReport.update({
        where: { id: cf.reportId },
        data: { status: ReportStatus.RESOLVED },
      });
    } else if (status === CaseStatus.SUSPECT_DETAINED || status === CaseStatus.SUSPECT_ARRESTED) {
      await tx.incidentReport.updateMany({
        where: { id: cf.reportId, status: { not: ReportStatus.RESOLVED } },
        data: { status: ReportStatus.UNDER_INVESTIGATION },
      });
    } else if (
      status === CaseStatus.RESPONDING ||
      status === CaseStatus.INVESTIGATING ||
      status === CaseStatus.OPEN
    ) {
      await tx.incidentReport.updateMany({
        where: { id: cf.reportId, status: { not: ReportStatus.RESOLVED } },
        data: { status: ReportStatus.UNDER_INVESTIGATION },
      });
    }
  });

  return ok("Case updated", {
    case: {
      id: cf.id,
      status,
    },
  });
}
