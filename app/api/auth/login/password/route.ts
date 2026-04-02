import { OtpPurpose } from "@prisma/client";
import { NextRequest } from "next/server";
import { env } from "@/src/lib/config/env";
import { issueTokens } from "@/src/lib/auth/session";
import { createOtp } from "@/src/lib/auth/otp";
import { verifyPassword } from "@/src/lib/auth/hash";
import { sendOtpEmail } from "@/src/lib/email/resend";
import { buildAppUserPayload } from "@/src/lib/auth/app-user";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { passwordLoginSchema } from "@/src/lib/validation/auth";
import { isRateLimited } from "@/src/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const body = await request.json().catch(() => null);
  const parsed = passwordLoginSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid request body", 400, parsed.error.flatten());
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  if (isRateLimited(`password-login:${normalizedEmail}:${ip}`, 10, 10 * 60 * 1000)) {
    return fail("Too many login attempts. Please try later.", 429);
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return fail("Invalid credentials", 401);
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    return fail("Invalid credentials", 401);
  }

  if (!user.isEmailVerified) {
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

    return ok("Email is not verified. OTP sent.", {
      requiresOtp: true,
      email: normalizedEmail,
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const tokens = await issueTokens(user);

  const appUser = await buildAppUserPayload(user.id);
  if (!appUser) {
    return fail("User not found", 404);
  }

  return ok("Login successful", {
    user: appUser,
    ...tokens,
  });
}
