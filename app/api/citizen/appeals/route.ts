import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { distanceKm } from "@/src/lib/geo/distance";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const radiusKm = Math.min(500, Math.max(1, Number(searchParams.get("radiusKm")) || 50));

  const now = new Date();

  const appeals = await prisma.publicAppeal.findMany({
    where: {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      case: {
        select: {
          caseNumber: true,
        },
      },
    },
  });

  let items = appeals.map((a) => ({
    id: a.id,
    caseId: a.caseId,
    caseNumber: a.case.caseNumber,
    title: a.title,
    description: a.description,
    imageUrl: a.imageUrl,
    latitude: a.latitude,
    longitude: a.longitude,
    radiusKm: a.radiusKm,
    expiresAt: a.expiresAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));

  if (latRaw !== null && lngRaw !== null && latRaw !== "" && lngRaw !== "") {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fail("lat and lng must be valid numbers", 400);
    }
    items = items.filter((a) => distanceKm(lat, lng, a.latitude, a.longitude) <= radiusKm);
  }

  return ok("Appeals", { appeals: items });
}
