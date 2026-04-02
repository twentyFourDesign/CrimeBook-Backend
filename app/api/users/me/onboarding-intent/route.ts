import { NextRequest } from "next/server";
import { OnboardingIntent, UserRole, VerificationStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { buildAppUserPayload } from "@/src/lib/auth/app-user";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const bodySchema = z.object({
  intent: z.nativeEnum(OnboardingIntent),
});

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.CITIZEN) {
    return fail("Only citizen accounts can set onboarding intent", 400);
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

  const pending = await prisma.policeOfficerApplication.findUnique({
    where: { userId: user.id },
    select: { verificationStatus: true },
  });
  if (pending?.verificationStatus === VerificationStatus.PENDING) {
    return fail("Complete or withdraw your police application before changing role path.", 400);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { onboardingIntent: parsed.data.intent },
  });

  const appUser = await buildAppUserPayload(user.id);
  if (!appUser) {
    return fail("User not found", 404);
  }

  return ok("Onboarding intent updated", { user: appUser });
}
