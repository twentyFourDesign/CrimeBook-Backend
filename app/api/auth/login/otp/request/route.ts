import { OtpPurpose } from "@prisma/client";
import { NextRequest } from "next/server";
import { env } from "@/src/lib/config/env";
import { createOtp } from "@/src/lib/auth/otp";
import { sendOtpEmail } from "@/src/lib/email/resend";
import { ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { otpRequestSchema } from "@/src/lib/validation/auth";
import { isRateLimited } from "@/src/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const body = await request.json().catch(() => null);
  const parsed = otpRequestSchema.safeParse(body);

  if (!parsed.success) {
    return ok("If this email is eligible, an OTP has been sent.");
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  if (isRateLimited(`otp-request:${normalizedEmail}:${ip}`, 5, 10 * 60 * 1000)) {
    return ok("If this email is eligible, an OTP has been sent.");
  }
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (user?.isEmailVerified) {
    const otp = await createOtp({
      email: normalizedEmail,
      purpose: OtpPurpose.SIGN_IN,
      userId: user.id,
    });

    await sendOtpEmail({
      to: normalizedEmail,
      code: otp.code,
      purpose: "signin",
      expiresMinutes: env.OTP_EXPIRES_MINUTES,
    });
  }

  return ok("If this email is eligible, an OTP has been sent.");
}
