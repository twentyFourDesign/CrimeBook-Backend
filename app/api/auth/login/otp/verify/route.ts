import { OtpPurpose } from "@prisma/client";
import { NextRequest } from "next/server";
import { issueTokens } from "@/src/lib/auth/session";
import { verifyOtp } from "@/src/lib/auth/otp";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { otpVerifySchema } from "@/src/lib/validation/auth";
import { isRateLimited } from "@/src/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const body = await request.json().catch(() => null);
  const parsed = otpVerifySchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid request body", 400, parsed.error.flatten());
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  if (isRateLimited(`otp-verify:${normalizedEmail}:${ip}`, 10, 10 * 60 * 1000)) {
    return fail("Too many attempts. Try again later.", 429);
  }
  const result = await verifyOtp({
    email: normalizedEmail,
    code: parsed.data.code,
    purpose: OtpPurpose.SIGN_IN,
  });

  if (!result.ok) {
    return fail("Invalid or expired OTP.", 400, { reason: result.reason });
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user || !user.isEmailVerified) {
    return fail("Account not eligible for OTP sign in.", 401);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = await issueTokens(user);

  return ok("Login successful", {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
    ...tokens,
  });
}
