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

  const membership = await prisma.communityGroupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });
  if (!membership) {
    return fail("Not a member", 400);
  }
  if (membership.role === GroupRole.OWNER) {
    return fail("Transfer ownership before leaving", 400);
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityGroupMember.delete({
      where: { id: membership.id },
    });
    await tx.communityGroup.update({
      where: { id: groupId },
      data: { memberCount: { decrement: 1 } },
    });
  });

  return ok("Left group", { left: true });
}
