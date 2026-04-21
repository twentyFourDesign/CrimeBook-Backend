import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { runAnalyticsComputation } from "@/src/lib/analytics/compute";

export async function GET(request: NextRequest) {
  try {
    const { error, user } = await requireUser(request);
    if (error || !user) {
      return fail(error ?? "Unauthorized", 401);
    }

    if (!requireRole(user, [UserRole.SYSTEM_ADMIN, UserRole.POLICE_COMMAND])) {
      return fail("Forbidden", 403);
    }

    const [hotspots, patterns, metrics] = await Promise.all([
      prisma.crimeHotspot.findMany({
        orderBy: { riskScore: "desc" },
        take: 100,
      }),
      prisma.crimePattern.findMany({
        take: 100,
      }),
      prisma.operationalMetric.findMany({
        orderBy: { computedAt: "desc" },
        take: 100,
      }),
    ]);

    return ok("Analytics data", {
      hotspots,
      patterns,
      metrics,
    });
  } catch (e) {
    console.error("[admin/analytics] GET", e);
    return fail(e instanceof Error ? e.message : "Internal Server Error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requireUser(request);
    if (error || !user) {
      return fail(error ?? "Unauthorized", 401);
    }

    if (!requireRole(user, [UserRole.SYSTEM_ADMIN])) {
      return fail("Forbidden", 403);
    }

    const result = await runAnalyticsComputation();

    return ok("Analytics computation completed", result);
  } catch (e) {
    console.error("[admin/analytics] POST", e);
    return fail(e instanceof Error ? e.message : "Internal Server Error", 500);
  }
}
