import { NextRequest } from "next/server";
import { VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const applicantSchema = z.object({
  fullName: z.string().min(1).max(200),
  idNumber: z.string().min(1).max(100),
  address: z.object({
    street: z.string().min(1).max(500),
    city: z.string().min(1).max(200),
    zip: z.string().min(1).max(32),
  }),
  phone: z.string().max(40).optional(),
});

const bodySchema = z.object({
  idDocumentType: z.enum(["national_id", "passport", "drivers_license"]),
  /** Real URL when uploading to storage; otherwise omitted and a placeholder is stored. */
  idDocumentUrl: z.string().url().optional(),
  applicant: applicantSchema,
});

export async function POST(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
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

  const data = parsed.data;
  const docUrl =
    data.idDocumentUrl ??
    `https://placeholder.crimebook.app/verification/${user.id}/id-document`;

  const reviewNotes = JSON.stringify({
    type: "citizen_verification_applicant",
    ...data.applicant,
    submittedAt: new Date().toISOString(),
  });

  await prisma.communityVerification.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      idDocumentUrl: docUrl,
      idDocumentType: data.idDocumentType,
      verificationStatus: VerificationStatus.PENDING,
      reviewNotes,
    },
    update: {
      idDocumentUrl: docUrl,
      idDocumentType: data.idDocumentType,
      verificationStatus: VerificationStatus.PENDING,
      reviewNotes,
      reviewedBy: null,
      verifiedAt: null,
    },
  });

  return ok("Verification submitted", { submitted: true });
}
