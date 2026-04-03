import { NextRequest } from "next/server";
import { GroupRole } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string; postId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id: groupId, postId } = await context.params;

  const post = await prisma.communityPost.findFirst({
    where: { id: postId, groupId, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!post) {
    return fail("Post not found", 404);
  }

  const member = await prisma.communityGroupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
    select: { role: true },
  });

  const canModerate =
    member?.role === GroupRole.OWNER || member?.role === GroupRole.MODERATOR;
  const isAuthor = post.authorId === user.id;

  if (!isAuthor && !canModerate) {
    return fail("Forbidden", 403);
  }

  await prisma.communityPost.update({
    where: { id: postId },
    data: { deletedAt: new Date() },
  });

  return ok("Post deleted", { deleted: true });
}
