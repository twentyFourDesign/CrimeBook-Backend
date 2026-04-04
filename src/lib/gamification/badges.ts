import { prisma } from "@/src/lib/prisma";
import { awardPoints } from "./award";

/**
 * Interface for badge eligibility check
 */
export async function awardBadgeIfEligible(userId: string, criteria: string) {
  try {
    const badge = await prisma.badge.findFirst({
      where: { criteria },
    });

    if (!badge) {
      console.warn(`Badge with criteria ${criteria} not found.`);
      return { awarded: false, error: "Badge not found" };
    }

    const existing = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existing) {
      return { awarded: false, message: "Already earned" };
    }

    return await prisma.$transaction(async (tx) => {
      const stillExisting = await tx.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id,
          },
        },
      });

      if (stillExisting) return { awarded: false };

      const userBadge = await tx.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
        },
      });

      if (badge.pointsValue > 0) {
        await awardPoints({
          userId,
          points: badge.pointsValue,
          reason: `Earned Badge: ${badge.name}`,
          referenceId: `badge_award:${userBadge.id}`,
          tx,
        });
      }

      return { awarded: true, badge };
    });
  } catch (error) {
    console.error("Error awarding badge:", error);
    return { awarded: false, error: String(error) };
  }
}
