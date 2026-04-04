import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ inviteId: string }> };

const respondSchema = z.object({
  accept: z.boolean(),
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { inviteId } = await context.params;

  try {
    const body = await request.json();
    const { accept } = respondSchema.parse(body);

    const invite = await prisma.groupInvite.findUnique({
      where: { id: inviteId },
    });

    if (!invite || invite.email !== user.email) {
      return fail("Invitation not found", 404);
    }

    if (invite.status !== "PENDING") {
      return fail("This invitation has already been processed", 400);
    }

    if (!accept) {
      await prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: "DECLINED" },
      });
      return ok("Invitation declined");
    }

    // Process acceptance
    await prisma.$transaction([
      prisma.groupInvite.update({
        where: { id: inviteId },
        data: { status: "ACCEPTED" },
      }),
      prisma.communityGroupMember.upsert({
        where: {
          groupId_userId: {
            groupId: invite.groupId,
            userId: user.id,
          },
        },
        create: {
          groupId: invite.groupId,
          userId: user.id,
          role: "MEMBER",
        },
        update: {}, // if already a member, do nothing
      }),
      prisma.communityGroup.update({
        where: { id: invite.groupId },
        data: {
          memberCount: {
            increment: 1,
          },
        },
      }),
    ]);

    return ok("Invitation accepted! You are now a member of the group.");
  } catch (e) {
    if (e instanceof z.ZodError) {
      return fail("Invalid input", 400, e.issues);
    }
    return fail(e instanceof Error ? e.message : "Failed to process invitation", 500);
  }
}
