import { NextRequest } from "next/server";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";
import { getBearerToken } from "@/src/lib/auth/request";
import { verifyAccessToken } from "@/src/lib/auth/jwt";

export async function requireUser(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return { error: "Missing access token" as const, user: null };

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true },
    });
    if (!user) return { error: "User not found" as const, user: null };
    if (user.status === UserStatus.SUSPENDED || user.status === UserStatus.DEACTIVATED) {
      return { error: "Account is disabled" as const, user: null };
    }
    return { error: null, user };
  } catch {
    return { error: "Invalid access token" as const, user: null };
  }
}

export function requireRole(user: { role: UserRole }, roles: UserRole[]) {
  return roles.includes(user.role);
}
