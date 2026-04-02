import { NextRequest } from "next/server";
import {
  PatrolStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
} from "@prisma/client";
import { z } from "zod";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNotes: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (!requireRole(user, [UserRole.SYSTEM_ADMIN])) {
    return fail("Forbidden", 403);
  }

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation failed", 400, parsed.error.flatten());
  }

  const application = await prisma.policeOfficerApplication.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!application) {
    return fail("Application not found", 404);
  }

  if (application.verificationStatus !== VerificationStatus.PENDING) {
    return fail("This application is no longer pending", 400);
  }

  const { action, reviewNotes } = parsed.data;

  if (action === "reject") {
    await prisma.policeOfficerApplication.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.REJECTED,
        reviewedBy: user.id,
        reviewNotes: reviewNotes ?? "Rejected",
      },
    });

    return ok("Application rejected", { id, verificationStatus: VerificationStatus.REJECTED });
  }

  const badgeTaken = await prisma.officerProfile.findUnique({
    where: { badgeNumber: application.badgeNumber },
  });
  if (badgeTaken) {
    return fail("This badge number is already assigned to an officer in the system.", 409);
  }

  await prisma.$transaction([
    prisma.policeOfficerApplication.update({
      where: { id },
      data: {
        verificationStatus: VerificationStatus.APPROVED,
        reviewedBy: user.id,
        reviewNotes: reviewNotes ?? null,
        verifiedAt: new Date(),
      },
    }),
    prisma.officerProfile.create({
      data: {
        userId: application.userId,
        badgeNumber: application.badgeNumber,
        rank: application.rank,
        department: application.department,
        precinct: application.precinct,
        unitCode: application.unitCode,
        isCommandStaff: false,
        patrolStatus: PatrolStatus.INACTIVE,
      },
    }),
    prisma.user.update({
      where: { id: application.userId },
      data: {
        role: UserRole.POLICE_OFFICER,
        status: UserStatus.ACTIVE,
        onboardingIntent: null,
      },
    }),
  ]);

  return ok("Officer approved", { id, verificationStatus: VerificationStatus.APPROVED });
}
