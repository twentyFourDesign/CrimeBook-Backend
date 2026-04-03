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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit")) || 200));

  const rows = await prisma.crimePattern.findMany({
    orderBy: [{ avgIncidentCount: "desc" }],
    take: limit,
  });

  return ok("Patterns", {
    patterns: rows.map((p) => ({
      id: p.id,
      crimeCategory: p.crimeCategory,
      dayOfWeek: p.dayOfWeek,
      hourOfDay: p.hourOfDay,
      avgIncidentCount: p.avgIncidentCount,
      latitude: p.latitude,
      longitude: p.longitude,
      radiusKm: p.radiusKm,
      computedAt: p.computedAt.toISOString(),
    })),
  });
}
