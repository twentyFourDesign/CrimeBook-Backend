import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const messageSchema = z.object({
  content: z.string().min(1).max(5000),
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
    return fail("Join the group to view messages", 403);
  }

  const messages = await prisma.communityGroupMessage.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return ok("Messages", {
    messages: messages.reverse().map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: {
        id: m.sender.id,
        name: m.sender.name,
        avatarUrl: m.sender.avatarUrl,
      },
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
    return fail("Join the group to send messages", 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = messageSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid body", 400, parsed.error.flatten());
  }

  const message = await prisma.communityGroupMessage.create({
    data: {
      groupId,
      senderId: user.id,
      content: parsed.data.content.trim(),
    },
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          avatarUrl: true,
        },
      },
    },
  });

  return ok("Message sent", {
    message: {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
      sender: {
        id: message.sender.id,
        name: message.sender.name,
        avatarUrl: message.sender.avatarUrl,
      },
    },
  });
}
