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
  const metricName = searchParams.get("metricName");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));

  const rows = await prisma.operationalMetric.findMany({
    where: metricName ? { metricName } : undefined,
    orderBy: { computedAt: "desc" },
    take: limit,
  });

  return ok("Metrics", {
    metrics: rows.map((m) => ({
      id: m.id,
      metricName: m.metricName,
      metricValue: m.metricValue,
      dimension: m.dimension,
      periodStart: m.periodStart.toISOString(),
      periodEnd: m.periodEnd.toISOString(),
      computedAt: m.computedAt.toISOString(),
    })),
  });
}
