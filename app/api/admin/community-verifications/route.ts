import { NextRequest } from "next/server";
import { UserRole, VerificationStatus } from "@prisma/client";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (!requireRole(user, [UserRole.SYSTEM_ADMIN])) {
    return fail("Forbidden", 403);
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status") as VerificationStatus | null;
  const status =
    statusParam && Object.values(VerificationStatus).includes(statusParam)
      ? statusParam
      : VerificationStatus.PENDING;

  const rows = await prisma.communityVerification.findMany({
    where: { verificationStatus: status },
    orderBy: { submittedAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      },
    },
  });

  return ok("Community verifications", {
    items: rows.map((v) => ({
      id: v.id,
      userId: v.userId,
      verificationStatus: v.verificationStatus,
      idDocumentType: v.idDocumentType,
      idDocumentUrl: v.idDocumentUrl,
      reviewNotes: v.reviewNotes,
      submittedAt: v.submittedAt.toISOString(),
      verifiedAt: v.verifiedAt?.toISOString() ?? null,
      user: v.user,
    })),
  });
}
