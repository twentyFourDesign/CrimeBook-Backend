import { OtpPurpose } from "@prisma/client";
import { randomInt } from "node:crypto";
import { env } from "@/src/lib/config/env";
import { prisma } from "@/src/lib/prisma";
import { safeCompare, sha256 } from "@/src/lib/auth/hash";

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export async function createOtp(params: {
  email: string;
  purpose: OtpPurpose;
  userId?: string;
}) {
  await prisma.otpCode.updateMany({
    where: {
      email: params.email,
      purpose: params.purpose,
      isUsed: false,
    },
    data: {
      isUsed: true,
      usedAt: new Date(),
    },
  });

  const code = generateOtpCode();
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + env.OTP_EXPIRES_MINUTES * 60 * 1000);

  await prisma.otpCode.create({
    data: {
      email: params.email,
      userId: params.userId,
      purpose: params.purpose,
      code: codeHash,
      expiresAt,
    },
  });

  return { code, expiresAt };
}

export async function verifyOtp(params: {
  email: string;
  code: string;
  purpose: OtpPurpose;
}) {
  const otp = await prisma.otpCode.findFirst({
    where: {
      email: params.email,
      purpose: params.purpose,
      isUsed: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!otp) {
    return { ok: false as const, reason: "OTP_NOT_FOUND" };
  }

  if (otp.expiresAt < new Date()) {
    return { ok: false as const, reason: "OTP_EXPIRED" };
  }

  if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
    return { ok: false as const, reason: "OTP_MAX_ATTEMPTS" };
  }

  const providedHash = sha256(params.code);
  const valid = safeCompare(otp.code, providedHash);

  if (!valid) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false as const, reason: "OTP_INVALID" };
  }

  const usedOtp = await prisma.otpCode.update({
    where: { id: otp.id },
    data: { isUsed: true, usedAt: new Date() },
  });

  return { ok: true as const, otp: usedOtp };
}
