import { NextRequest } from "next/server";
import { GroupRole } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id: groupId } = await context.params;

  const group = await prisma.communityGroup.findFirst({
    where: { id: groupId, isActive: true },
    select: { id: true, memberCount: true },
  });
  if (!group) {
    return fail("Group not found", 404);
  }

  const existing = await prisma.communityGroupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });
  if (existing) {
    return ok("Already a member", { joined: true, role: existing.role });
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityGroupMember.create({
      data: {
        groupId,
        userId: user.id,
        role: GroupRole.MEMBER,
      },
    });
    await tx.communityGroup.update({
      where: { id: groupId },
      data: { memberCount: { increment: 1 } },
    });
  });

  return ok("Joined", { joined: true, role: GroupRole.MEMBER });
}
