import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const rows = await prisma.userBadge.findMany({
    where: { userId: user.id },
    include: {
      badge: true,
    },
    orderBy: { earnedAt: "desc" },
  });

  return ok("Your badges", {
    userBadges: rows.map((ub) => ({
      id: ub.id,
      earnedAt: ub.earnedAt.toISOString(),
      badge: {
        id: ub.badge.id,
        name: ub.badge.name,
        description: ub.badge.description,
        iconUrl: ub.badge.iconUrl,
        pointsValue: ub.badge.pointsValue,
      },
    })),
    reputationPoints: (
      await prisma.user.findUnique({
        where: { id: user.id },
        select: { reputationPoints: true },
      })
    )?.reputationPoints ?? 0,
  });
}
