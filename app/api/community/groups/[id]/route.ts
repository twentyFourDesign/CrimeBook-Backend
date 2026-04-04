import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id } = await context.params;

  const group = await prisma.communityGroup.findFirst({
    where: { id, isActive: true },
  });
  if (!group) {
    return fail("Group not found", 404);
  }

  const membership = await prisma.communityGroupMember.findUnique({
    where: {
      groupId_userId: {
        groupId: id,
        userId: user.id,
      },
    },
    select: { role: true },
  });

  return ok("Group", {
    group: {
      id: group.id,
      name: group.name,
      description: group.description,
      avatarUrl: group.avatarUrl,
      latitude: group.latitude,
      longitude: group.longitude,
      radiusKm: group.radiusKm,
      memberCount: group.memberCount,
      createdAt: group.createdAt.toISOString(),
      myRole: membership?.role ?? null,
      isMember: !!membership,
    },
  });
}
