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
          currentLatitude: true,
          currentLongitude: true,
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

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.POLICE_OFFICER && user.role !== UserRole.POLICE_COMMAND) {
    return fail("Forbidden", 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  if (typeof body !== "object" || body === null) {
    return fail("Invalid body", 400);
  }

  const { avatarUrl, currentLatitude, currentLongitude } = body as {
    avatarUrl?: unknown;
    currentLatitude?: unknown;
    currentLongitude?: unknown;
  };

  if (avatarUrl !== undefined && avatarUrl !== null && typeof avatarUrl !== "string") {
    return fail("avatarUrl must be a string or null", 400);
  }

  if (
    currentLatitude !== undefined &&
    currentLatitude !== null &&
    typeof currentLatitude !== "number"
  ) {
    return fail("currentLatitude must be a number or null", 400);
  }

  if (
    currentLongitude !== undefined &&
    currentLongitude !== null &&
    typeof currentLongitude !== "number"
  ) {
    return fail("currentLongitude must be a number or null", 400);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      avatarUrl: (avatarUrl as string | null | undefined) ?? undefined,
      officerProfile: {
        update: {
          currentLatitude: (currentLatitude as number | null | undefined) ?? undefined,
          currentLongitude: (currentLongitude as number | null | undefined) ?? undefined,
        },
      },
    },
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
          currentLatitude: true,
          currentLongitude: true,
        },
      },
    },
  });

  if (!updated.officerProfile) {
    return fail("Officer profile not found", 404);
  }

  return ok("Officer profile updated", {
    profile: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl,
      phone: updated.phone,
      city: updated.city,
      officerProfile: updated.officerProfile,
    },
  });
}

