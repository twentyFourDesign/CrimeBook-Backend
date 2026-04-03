import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const postSchema = z.object({
  content: z.string().min(1).max(10000),
  imageUrl: z.string().url().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id: groupId } = await context.params;

  const member = await prisma.communityGroupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });
  if (!member) {
    return fail("Join the group to view posts", 403);
  }

  const posts = await prisma.communityPost.findMany({
    where: { groupId, deletedAt: null },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      author: { select: { id: true, name: true } },
    },
  });

  return ok("Posts", {
    posts: posts.map((p) => ({
      id: p.id,
      content: p.content,
      imageUrl: p.imageUrl,
      latitude: p.latitude,
      longitude: p.longitude,
      isPinned: p.isPinned,
      createdAt: p.createdAt.toISOString(),
      author: { id: p.author.id, displayName: p.author.name.split(/\s+/)[0] ?? "Member" },
    })),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id: groupId } = await context.params;

  const member = await prisma.communityGroupMember.findUnique({
    where: {
      groupId_userId: { groupId, userId: user.id },
    },
  });
  if (!member) {
    return fail("Join the group to post", 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid body", 400, parsed.error.flatten());
  }

  const { content, imageUrl, latitude, longitude } = parsed.data;

  const post = await prisma.communityPost.create({
    data: {
      groupId,
      authorId: user.id,
      content: content.trim(),
      imageUrl: imageUrl ?? undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
    },
  });

  return ok("Post created", {
    post: {
      id: post.id,
      createdAt: post.createdAt.toISOString(),
    },
  });
}
