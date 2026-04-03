import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

/** Authenticated read of a report for community feed / confirmations (not limited to reporter). */
type RouteContext = { params: Promise<{ reportId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { reportId } = await context.params;

  const report = await prisma.incidentReport.findFirst({
    where: { id: reportId, deletedAt: null },
    select: {
      id: true,
      reporterId: true,
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
    },
  });

  if (!report) {
    return fail("Report not found", 404);
  }

  const myConfirmation = await prisma.reportConfirmation.findUnique({
    where: {
      reportId_userId: {
        reportId,
        userId: user.id,
      },
    },
    select: {
      isConfirmed: true,
      comment: true,
      createdAt: true,
    },
  });

  return ok("Report", {
    report: {
      id: report.id,
      isOwnReport: report.reporterId === user.id,
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
      myConfirmation: myConfirmation
        ? {
            isConfirmed: myConfirmation.isConfirmed,
            comment: myConfirmation.comment,
            createdAt: myConfirmation.createdAt.toISOString(),
          }
        : null,
    },
  });
}
