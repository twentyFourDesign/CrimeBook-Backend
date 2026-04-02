import { NextRequest } from "next/server";
import { OnboardingIntent, UserRole, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const bodySchema = z.object({
  badgeNumber: z.string().min(1).max(64),
  rank: z.string().min(1).max(120),
  department: z.string().min(1).max(200),
  precinct: z.string().min(1).max(200),
  unitCode: z.string().max(64).optional(),
  idDocumentUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.CITIZEN) {
    return fail("Only citizen accounts can apply", 400);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("Validation failed", 400, parsed.error.flatten());
  }

  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { onboardingIntent: true },
  });
  if (me?.onboardingIntent !== OnboardingIntent.POLICE) {
    return fail('Set your role to "Police" in the app before submitting this form.', 400);
  }

  const existing = await prisma.policeOfficerApplication.findUnique({
    where: { userId: user.id },
  });

  if (existing?.verificationStatus === VerificationStatus.PENDING) {
    return fail("Your application is already pending review.", 400);
  }

  if (existing?.verificationStatus === VerificationStatus.APPROVED) {
    return fail("You are already approved as an officer.", 400);
  }

  const data = parsed.data;
  const docUrl =
    data.idDocumentUrl ??
    `https://placeholder.crimebook.app/police-application/${user.id}/document`;

  await prisma.policeOfficerApplication.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      badgeNumber: data.badgeNumber.trim(),
      rank: data.rank.trim(),
      department: data.department.trim(),
      precinct: data.precinct.trim(),
      unitCode: data.unitCode?.trim() || null,
      idDocumentUrl: docUrl,
      verificationStatus: VerificationStatus.PENDING,
    },
    update: {
      badgeNumber: data.badgeNumber.trim(),
      rank: data.rank.trim(),
      department: data.department.trim(),
      precinct: data.precinct.trim(),
      unitCode: data.unitCode?.trim() || null,
      idDocumentUrl: docUrl,
      verificationStatus: VerificationStatus.PENDING,
      reviewedBy: null,
      reviewNotes: null,
      verifiedAt: null,
    },
  });

  return ok("Application submitted", { submitted: true });
}
