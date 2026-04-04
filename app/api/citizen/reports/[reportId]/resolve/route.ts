import { NextRequest } from "next/server";
import { ReportStatus, ReporterResolutionStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { awardPoints } from "@/src/lib/gamification/award";
import { recordReportStatusChange } from "@/src/lib/reports/status-history";

const resolveSchema = z.object({
  status: z.enum(["CONFIRMED", "DISPUTED"]),
  notes: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ reportId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { reportId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = resolveSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation failed", 400, parsed.error.flatten());
  }

  const { status, notes } = parsed.data;

  try {
    const report = await prisma.incidentReport.findUnique({
      where: { id: reportId },
      select: { id: true, reporterId: true, status: true },
    });

    if (!report) return fail("Report not found", 404);
    if (report.reporterId !== user.id) return fail("Only the reporter can confirm resolution", 403);
    
    // Check if it's in the correct state
    // We use a string check here for the new status 'POLICE_RESOLVED' to avoid type errors before schema generation
    if ((report.status as string) !== "POLICE_RESOLVED") {
      return fail("This incident is not awaiting your resolution confirmation", 400);
    }

    const nextStatus = status === "CONFIRMED" ? "RESOLVED" : "UNDER_INVESTIGATION";

    await prisma.$transaction(async (tx) => {
      await tx.incidentReport.update({
        where: { id: reportId },
        data: {
          reporterResolutionStatus: status as ReporterResolutionStatus,
          reporterResolutionNotes: notes ?? null,
          reporterConfirmedAt: new Date(),
          status: nextStatus as ReportStatus,
        },
      });

      await recordReportStatusChange({
        reportId: report.id,
        fromStatus: report.status,
        toStatus: nextStatus as ReportStatus,
        changedById: user.id,
        notes: `Reporter ${status.toLowerCase()}ed resolution. Notes: ${notes ?? "none"}`,
        tx,
      });

      if (status === "CONFIRMED") {
        // Award points for final resolution
        await awardPoints({
          userId: user.id,
          points: 20,
          reason: "Confirmed incident resolution",
          referenceId: `resolve_confirm:${reportId}`,
          tx,
        });
      }
    });

    return ok(`Resolution ${status.toLowerCase()}ed successfully`, {
      nextStatus,
    });
  } catch (e) {
    console.error("[report resolve POST]", e);
    return fail("Could not process resolution confirmation", 500);
  }
}
