import { NextRequest } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { ok, fail } from "@/src/lib/http/response";

export async function GET(request: NextRequest) {
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
    statusFilter = { equals: statusParam.toUpperCase() }; // Just in case a specific one is passed
  }
  
  let categoryFilter = {};
  if (categoryParam && categoryParam !== "all") {
    categoryFilter = categoryParam.toUpperCase();
  }

  try {
    const reports = await prisma.incidentReport.findMany({
      where: {
        ...(gteDate ? { createdAt: { gte: gteDate } } : {}),
        ...boundsFilter,
        ...(Object.keys(statusFilter).length > 0 ? { status: statusFilter } : {}),
        ...(Object.keys(categoryFilter).length > 0 ? { crimeCategory: categoryFilter } : {}),
      },
      select: {
        id: true,
        latitude: true,
        longitude: true,
        crimeCategory: true,
        status: true,
      },
      // Limit to avoid sending massive payloads
      take: 2000,
    });

    const heatmapData = reports.map((r) => {
      // Determine weight based on severity or type. 
      // This is a simple mock mapping for severity.
      let weight = 1;
      if (
        r.crimeCategory === "ROBBERY" ||
        r.crimeCategory === "ASSAULT" ||
        r.crimeCategory === "KIDNAPPING"
      ) {
        weight = 3;
      } else if (
        r.crimeCategory === "DOMESTIC_VIOLENCE" ||
        r.crimeCategory === "DRUG_ACTIVITY"
      ) {
        weight = 2;
      }

      return {
        latitude: r.latitude,
        longitude: r.longitude,
        weight,
        id: r.id,
      };
    });

    return ok("Heatmap data retrieved", { incidents: heatmapData });
  } catch (err) {
    console.error("[heatmap GET] error", err);
    return fail("Failed to fetch heatmap data", 500);
  }
}
