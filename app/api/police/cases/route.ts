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

  const cases = await prisma.caseFile.findMany({
    where: {
      assignments: {
        some: {
          officerId: user.id,
          removedAt: null,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      caseNumber: true,
      status: true,
      priority: true,
      notes: true,
      createdAt: true,
      report: {
        select: {
          id: true,
          crimeCategory: true,
          title: true,
          locationAddress: true,
          locationLabel: true,
          latitude: true,
          longitude: true,
          incidentTime: true,
        },
      },
    },
  });

  return ok("Assigned cases", {
    cases: cases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      status: c.status,
      priority: c.priority,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      report: {
        id: c.report.id,
        crimeCategory: c.report.crimeCategory,
        title: c.report.title,
        locationAddress: c.report.locationAddress,
        locationLabel: c.report.locationLabel,
        latitude: c.report.latitude,
        longitude: c.report.longitude,
        incidentTime: c.report.incidentTime.toISOString(),
      },
    })),
  });
}

