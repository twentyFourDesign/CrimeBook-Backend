import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.POLICE_OFFICER && user.role !== UserRole.POLICE_COMMAND) {
    return fail("Forbidden", 403);
  }

  const incidents = await prisma.incidentReport.findMany({
    // latitude/longitude are non-nullable on IncidentReport, so no need for a where filter
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      crimeCategory: true,
      status: true,
      latitude: true,
      longitude: true,
      locationAddress: true,
      locationLabel: true,
      createdAt: true,
      description: true,
      communityConfirmCount: true,
      isPoliceVerified: true,
    },
  });

  return ok("Police incidents", {
    incidents: incidents.map((r) => ({
      id: r.id,
      crimeCategory: r.crimeCategory,
      status: r.status,
      latitude: r.latitude,
      longitude: r.longitude,
      locationAddress: r.locationAddress,
      locationLabel: r.locationLabel,
      createdAt: r.createdAt.toISOString(),
      description: r.description,
      communityConfirmCount: r.communityConfirmCount,
      isPoliceVerified: r.isPoliceVerified,
    })),
  });
}

