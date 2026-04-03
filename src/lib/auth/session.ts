import { User, UserStatus } from "@prisma/client";
import jwt from "jsonwebtoken";
import { prisma } from "@/src/lib/prisma";
import { sha256 } from "@/src/lib/auth/hash";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "@/src/lib/auth/jwt";

function getRefreshExpiryDate(token: string) {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  if (!decoded?.exp) {
    return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  return new Date(decoded.exp * 1000);
}

export async function issueTokens(user: User) {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    email: user.email,
  });

  const provisionalRefresh = signRefreshToken({
    sub: user.id,
    sid: "pending",
    tokenVersion: 1,
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token: sha256(provisionalRefresh),
      expiresAt: getRefreshExpiryDate(provisionalRefresh),
    },
  });

  const refreshToken = signRefreshToken({
    sub: user.id,
    sid: session.id,
    tokenVersion: 1,
  });

  await prisma.session.update({
    where: { id: session.id },
    data: { token: sha256(refreshToken), expiresAt: getRefreshExpiryDate(refreshToken) },
  });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);
  const hashed = sha256(refreshToken);

  const existing = await prisma.session.findFirst({
    where: {
      id: payload.sid,
      userId: payload.sub,
      token: hashed,
      isActive: true,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!existing) {
    return null;
  }

  if (
    existing.user.status === UserStatus.SUSPENDED ||
    existing.user.status === UserStatus.DEACTIVATED
  ) {
    await prisma.session.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    return null;
  }

  await prisma.session.update({
    where: { id: existing.id },
    data: { isActive: false },
  });

  return issueTokens(existing.user);
}

export async function revokeRefreshToken(refreshToken: string) {
  const hashed = sha256(refreshToken);
  await prisma.session.updateMany({
    where: { token: hashed, isActive: true },
    data: { isActive: false },
  });
}
