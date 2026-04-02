import { NextRequest } from "next/server";
import { UserRole, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const querySchema = z.object({
  status: z.nativeEnum(VerificationStatus).optional(),
});

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (!requireRole(user, [UserRole.SYSTEM_ADMIN])) {
    return fail("Forbidden", 403);
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: searchParams.get("status") ?? "PENDING",
  });
  if (!parsed.success) {
    return fail("Invalid query", 400, parsed.error.flatten());
  }

  const status = parsed.data.status ?? VerificationStatus.PENDING;

  const rows = await prisma.policeOfficerApplication.findMany({
    where: { verificationStatus: status },
    orderBy: { submittedAt: "asc" },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true },
      },
    },
  });

  const items = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    badgeNumber: r.badgeNumber,
    rank: r.rank,
    department: r.department,
    precinct: r.precinct,
    unitCode: r.unitCode,
    idDocumentUrl: r.idDocumentUrl,
    verificationStatus: r.verificationStatus,
    reviewNotes: r.reviewNotes,
    submittedAt: r.submittedAt.toISOString(),
    user: r.user,
  }));

  return ok("OK", { items });
}
