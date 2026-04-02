import { OtpPurpose, UserStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { issueTokens } from "@/src/lib/auth/session";
import { verifyOtp } from "@/src/lib/auth/otp";
import { buildAppUserPayload } from "@/src/lib/auth/app-user";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { verifySignupOtpSchema } from "@/src/lib/validation/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = verifySignupOtpSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid request body", 400, parsed.error.flatten());
  }

  const { email, code } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const result = await verifyOtp({
    email: normalizedEmail,
    code,
    purpose: OtpPurpose.EMAIL_VERIFICATION,
  });

  if (!result.ok) {
    return fail("Invalid or expired OTP.", 400, { reason: result.reason });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return fail("Account not found", 404);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      status: UserStatus.ACTIVE,
      lastLoginAt: new Date(),
    },
  });

  const tokens = await issueTokens(updated);

  const appUser = await buildAppUserPayload(updated.id);
  if (!appUser) {
    return fail("User not found", 404);
  }

  return ok("Email verified successfully.", {
    user: appUser,
    ...tokens,
  });
}
