import { NextRequest } from "next/server";
import { UserRole, VerificationStatus } from "@prisma/client";
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

  const verification = await prisma.communityVerification.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!verification) {
    return fail("Verification not found", 404);
  }

  if (verification.verificationStatus !== VerificationStatus.PENDING) {
    return fail("This request is no longer pending", 400);
  }

  const { action, reviewNotes } = parsed.data;

  if (action === "approve") {
    await prisma.$transaction([
      prisma.communityVerification.update({
        where: { id },
        data: {
          verificationStatus: VerificationStatus.APPROVED,
          reviewedBy: user.id,
          reviewNotes: reviewNotes ?? null,
          verifiedAt: new Date(),
        },
      }),
      prisma.user.update({
        where: { id: verification.userId },
        data: { role: UserRole.VERIFIED_COMMUNITY_MEMBER },
      }),
    ]);

    return ok("Applicant approved", { id, verificationStatus: VerificationStatus.APPROVED });
  }

  await prisma.communityVerification.update({
    where: { id },
    data: {
      verificationStatus: VerificationStatus.REJECTED,
      reviewedBy: user.id,
      reviewNotes: reviewNotes ?? "Rejected",
    },
  });

  return ok("Applicant rejected", { id, verificationStatus: VerificationStatus.REJECTED });
}
