import { NextRequest } from "next/server";
import { getBearerToken } from "@/src/lib/auth/request";
import { verifyAccessToken } from "@/src/lib/auth/jwt";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return fail("Missing access token", 401);
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isEmailVerified: true,
      },
    });

    if (!user) {
      return fail("User not found", 404);
    }

    return ok("Current user fetched", { user });
  } catch {
    return fail("Invalid access token", 401);
  }
}
