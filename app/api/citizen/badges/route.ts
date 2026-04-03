import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

async function ensureDefaultBadges() {
  const n = await prisma.badge.count();
  if (n > 0) return;
  await prisma.badge.createMany({
    data: [
      {
        name: "community_voice",
        description: "Confirmed another resident's report",
        iconUrl: "/badges/community_voice.svg",
        criteria: "Submit a community confirmation",
        pointsValue: 5,
      },
      {
        name: "first_report",
        description: "Submitted your first incident report",
        iconUrl: "/badges/first_report.svg",
        criteria: "Create one report",
        pointsValue: 10,
      },
      {
        name: "trusted_reporter",
        description: "Building a trusted reporting history",
        iconUrl: "/badges/trusted.svg",
        criteria: "Earn 100 reputation points",
        pointsValue: 0,
      },
    ],
    skipDuplicates: true,
  });
}

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  await ensureDefaultBadges();

  const badges = await prisma.badge.findMany({
    orderBy: { name: "asc" },
  });

  return ok("Badges", {
    badges: badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      iconUrl: b.iconUrl,
      criteria: b.criteria,
      pointsValue: b.pointsValue,
    })),
  });
}
