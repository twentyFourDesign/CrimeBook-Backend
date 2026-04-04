import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const inviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id: groupId } = await context.params;

  try {
    const body = await request.json();
    const { email } = inviteSchema.parse(body);

    // 1. Check if group exists
    const group = await prisma.communityGroup.findUnique({
      where: { id: groupId, isActive: true },
    });
    if (!group) {
      return fail("Group not found", 404);
    }

    // 2. Check if the inviter is a member of the group
    const inviterMembership = await prisma.communityGroupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: user.id,
        },
      },
    });
    if (!inviterMembership) {
      return fail("You must be a member of this group to invite others", 403);
    }

    // 3. Check if the person is already a member
    const targetUser = await prisma.user.findUnique({
      where: { email },
    });

    if (targetUser) {
      const existingMembership = await prisma.communityGroupMember.findUnique({
        where: {
          groupId_userId: {
            groupId,
            userId: targetUser.id,
          },
        },
      });
      if (existingMembership) {
        return fail("User is already a member of this group", 400);
      }
    }

    // 4. Check if an invite already exists
    const existingInvite = await prisma.groupInvite.findUnique({
      where: {
        groupId_email: {
          groupId,
          email,
        },
      },
    });

    if (existingInvite) {
      if (existingInvite.status === "PENDING") {
        return fail("An invitation has already been sent to this email", 400);
      }
      // If they were declined or accepted before, we can allow a re-invite
      // but let's just update the status to PENDING again
      await prisma.groupInvite.update({
        where: { id: existingInvite.id },
        data: { status: "PENDING", inviterId: user.id },
      });
      return ok("Invitation sent successfully");
    }

    // 5. Create the invite
    await prisma.groupInvite.create({
      data: {
        groupId,
        inviterId: user.id,
        email,
        status: "PENDING",
      },
    });

    return ok("Invitation sent successfully");
  } catch (e) {
    if (e instanceof z.ZodError) {
      return fail("Invalid input", 400, e.issues);
    }
    return fail(e instanceof Error ? e.message : "Failed to send invitation", 500);
  }
}
