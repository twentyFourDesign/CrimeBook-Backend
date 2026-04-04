import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const invites = await prisma.groupInvite.findMany({
    where: {
      email: user.email,
      status: "PENDING",
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          description: true,
          avatarUrl: true,
        },
      },
      inviter: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok("My group invitations", { invites });
}
