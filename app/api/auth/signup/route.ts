import { OtpPurpose, UserRole, UserStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { env } from "@/src/lib/config/env";
import { sendOtpEmail } from "@/src/lib/email/resend";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { signupSchema } from "@/src/lib/validation/auth";
import { buildUsername } from "@/src/lib/auth/user";
import { hashPassword } from "@/src/lib/auth/hash";
import { createOtp } from "@/src/lib/auth/otp";
import { isRateLimited } from "@/src/lib/auth/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid request body", 400, parsed.error.flatten());
  }

  const { email, name, password, role } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  if (isRateLimited(`signup:${normalizedEmail}:${ip}`, 5, 10 * 60 * 1000)) {
    return fail("Too many signup attempts. Please try later.", 429);
  }
  const passwordHash = await hashPassword(password);

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing?.isEmailVerified) {
    return fail("Account already exists. Please login.", 409);
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          passwordHash,
          role: role ?? existing.role,
          status: UserStatus.PENDING_VERIFICATION,
        },
      })
    : await prisma.user.create({
        data: {
          email: normalizedEmail,
          name,
          username: buildUsername(normalizedEmail),
          passwordHash,
          role: role ?? UserRole.CITIZEN,
          status: UserStatus.PENDING_VERIFICATION,
        },
      });

  const otp = await createOtp({
    email: user.email,
    purpose: OtpPurpose.EMAIL_VERIFICATION,
    userId: user.id,
  });

  await sendOtpEmail({
    to: user.email,
    code: otp.code,
    purpose: "signup",
    expiresMinutes: env.OTP_EXPIRES_MINUTES,
  });

  return ok("Signup successful. OTP sent to your email.", {
    email: user.email,
    requiresOtp: true,
  });
}
