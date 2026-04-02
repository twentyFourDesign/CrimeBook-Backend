import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

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
    include: {
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
    },
  });
}
