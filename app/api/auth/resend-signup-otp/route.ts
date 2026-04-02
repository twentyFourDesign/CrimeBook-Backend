import { OtpPurpose } from "@prisma/client";
import { NextRequest } from "next/server";
import { env } from "@/src/lib/config/env";
import { createOtp } from "@/src/lib/auth/otp";
import { sendOtpEmail } from "@/src/lib/email/resend";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { otpRequestSchema } from "@/src/lib/validation/auth";
import { isRateLimited } from "@/src/lib/auth/rate-limit";

/** Resend email verification OTP during sign-up (same purpose as initial signup). */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const body = await request.json().catch(() => null);
  const parsed = otpRequestSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid email", 400, parsed.error.flatten());
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  if (isRateLimited(`resend-signup-otp:${normalizedEmail}:${ip}`, 5, 10 * 60 * 1000)) {
    return fail("Too many resend attempts. Please try again in a few minutes.", 429);
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, isEmailVerified: true },
  });

  if (!user) {
    return fail("No account found for this email. Please sign up again.", 404);
  }

  if (user.isEmailVerified) {
    return fail("This email is already verified. Please log in.", 400);
  }

  const otp = await createOtp({
    email: normalizedEmail,
    purpose: OtpPurpose.EMAIL_VERIFICATION,
    userId: user.id,
  });

  await sendOtpEmail({
    to: normalizedEmail,
    code: otp.code,
    purpose: "signup",
    expiresMinutes: env.OTP_EXPIRES_MINUTES,
  });

  return ok("A new verification code has been sent to your email.", { sent: true });
}
