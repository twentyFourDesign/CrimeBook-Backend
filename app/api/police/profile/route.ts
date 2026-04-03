import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.POLICE_OFFICER && user.role !== UserRole.POLICE_COMMAND) {
    return fail("Forbidden", 403);
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      phone: true,
      city: true,
      officerProfile: {
        select: {
          badgeNumber: true,
          rank: true,
          department: true,
          precinct: true,
          unitCode: true,
          isCommandStaff: true,
          patrolStatus: true,
        },
      },
    },
  });

  if (!row || !row.officerProfile) {
    return fail("Officer profile not found", 404);
  }

  return ok("Officer profile", {
    profile: {
      id: row.id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatarUrl,
      phone: row.phone,
      city: row.city,
      officerProfile: row.officerProfile,
    },
  });
}

