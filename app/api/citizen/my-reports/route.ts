import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const reports = await prisma.incidentReport.findMany({
    where: { reporterId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      caseId: true,
      crimeCategory: true,
      title: true,
      status: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      latitude: true,
      longitude: true,
      locationAddress: true,
      locationLabel: true,
      isPoliceVerified: true,
    },
  });

  return ok("Your reports", {
    reports: reports.map((r: (typeof reports)[number]) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}
