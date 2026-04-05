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

  const searchParams = request.nextUrl.searchParams;
  const time = searchParams.get("time");
  const neParam = searchParams.get("ne");
  const swParam = searchParams.get("sw");
  const statusParam = searchParams.get("status") || "active";
  const categoryParam = searchParams.get("category") || "all";

  let gteDate: Date | undefined;
  if (time === "6h") {
    gteDate = new Date(Date.now() - 6 * 60 * 60 * 1000);
  } else if (time === "24h") {
    gteDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  } else if (time === "7d") {
    gteDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }

  let boundsFilter = {};
  if (neParam && swParam) {
    const [neLat, neLng] = neParam.split(",").map(Number);
    const [swLat, swLng] = swParam.split(",").map(Number);
    if (!isNaN(neLat) && !isNaN(swLat) && !isNaN(neLng) && !isNaN(swLng)) {
      boundsFilter = {
        latitude: { gte: swLat, lte: neLat },
        longitude: { gte: swLng, lte: neLng },
      };
    }
  }

  let statusFilter = {};
  if (statusParam === "active") {
    statusFilter = { in: ["SUBMITTED", "COMMUNITY_CONFIRMED", "POLICE_VERIFIED", "UNDER_INVESTIGATION"] };
  } else if (statusParam === "solved") {
    statusFilter = { in: ["POLICE_RESOLVED", "RESOLVED"] };
  } else if (statusParam !== "all") {
    statusFilter = { equals: statusParam.toUpperCase() };
  }

  let categoryFilter = {};
  if (categoryParam && categoryParam !== "all") {
    categoryFilter = categoryParam.toUpperCase();
  }

  const incidents = await prisma.incidentReport.findMany({
    where: {
      ...(gteDate ? { createdAt: { gte: gteDate } } : {}),
      ...boundsFilter,
      ...(Object.keys(statusFilter).length > 0 ? { status: statusFilter } : {}),
      ...(Object.keys(categoryFilter).length > 0 ? { crimeCategory: categoryFilter } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
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
      credibilityScore: true,
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
      credibilityScore: r.credibilityScore,
    })),
  });
}

