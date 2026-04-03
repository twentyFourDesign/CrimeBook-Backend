import { NextRequest } from "next/server";
import { CaseStatus, ReportStatus, UserRole } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.POLICE_OFFICER && user.role !== UserRole.POLICE_COMMAND) {
    return fail("Forbidden", 403);
  }

  const { id } = await context.params;

  const incident = await prisma.incidentReport.findUnique({
    where: { id },
    select: {
      id: true,
      caseId: true,
      status: true,
    },
  });

  if (!incident) {
    return fail("Report not found", 404);
  }

  const caseResult = await prisma.$transaction(async (tx) => {
    let caseFile =
      incident.caseId &&
      (await tx.caseFile.findUnique({
        where: { id: incident.caseId },
      }));

    if (!caseFile) {
      const now = new Date();
      const year = now.getFullYear();
      const short = incident.id.replace(/-/g, "").slice(0, 6).toUpperCase();
      const caseNumber = `CB-${year}-${short}`;

      caseFile = await tx.caseFile.create({
        data: {
          reportId: incident.id,
          caseNumber,
          status: CaseStatus.RESPONDING,
          priority: 2,
        },
      });

      await tx.incidentReport.update({
        where: { id: incident.id },
        data: {
          status: ReportStatus.UNDER_INVESTIGATION,
          caseId: caseFile.id,
        },
      });
    }

    const existingAssignment = await tx.caseAssignment.findFirst({
      where: {
        caseId: caseFile.id,
        officerId: user.id,
        removedAt: null,
      },
    });

    if (!existingAssignment) {
      await tx.caseAssignment.create({
        data: {
          caseId: caseFile.id,
          officerId: user.id,
          isLead: true,
        },
      });
    }

    return caseFile;
  });

  return ok("Case accepted", {
    caseId: caseResult.id,
    caseNumber: caseResult.caseNumber,
  });
}

