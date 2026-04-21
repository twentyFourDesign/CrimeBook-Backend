import type { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

const MAX_REPUTATION_POINTS = 50_000;


/**
 * Idempotent reward: same `referenceId` will not double-award for a user.
 * Caps total reputation points at MAX_REPUTATION_POINTS.
 */
export async function awardPoints(params: {
  userId: string;
  points: number;
  reason: string;
  referenceId?: string | null;
  tx?: Prisma.TransactionClient;
}): Promise<{ awarded: boolean }> {
  const { userId, points, reason, referenceId } = params;
  const client = params.tx ?? prisma;

  if (points === 0) {
    return { awarded: false };
  }

  if (referenceId) {
    const existing = await client.rewardHistory.findFirst({
      where: { userId, referenceId },
      select: { id: true },
    });
    if (existing) {
      return { awarded: false };
    }
  }

  const run = async (tx: Prisma.TransactionClient) => {
    await tx.rewardHistory.create({
      data: {
        userId,
        points,
        reason,
        referenceId: referenceId ?? undefined,
      },
    });
    const u = await tx.user.findUnique({
      where: { id: userId },
      select: { reputationPoints: true },
    });
    if (!u) return;
    const next = Math.min(MAX_REPUTATION_POINTS, Math.max(0, u.reputationPoints + points));
    
    // Trust score logic: Incremental gain based on activity (reputation points)
    // Here we add 0.5% trust for every 10 reputation points awarded, capped at 100.0
    const trustGain = Math.max(0, points * 0.05); 
    
    await tx.user.update({
      where: { id: userId },
      data: { 
        reputationPoints: next,
        trustScore: {
          increment: trustGain
        }
      },
    });
    
    // Cap trust score at 100.0
    const updatedUser = await tx.user.findUnique({ where: { id: userId }, select: { trustScore: true } });
    if (updatedUser && updatedUser.trustScore > 100) {
      await tx.user.update({
        where: { id: userId },
        data: { trustScore: 100.0 }
      });
    }
  };

  if (params.tx) {
    await run(params.tx);
  } else {
    await prisma.$transaction(run);
  }

  return { awarded: true };
}
