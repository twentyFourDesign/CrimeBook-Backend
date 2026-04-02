import { NextRequest } from "next/server";
import { rotateRefreshToken } from "@/src/lib/auth/session";
import { fail, ok } from "@/src/lib/http/response";
import { refreshSchema } from "@/src/lib/validation/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid request body", 400, parsed.error.flatten());
  }

  const rotated = await rotateRefreshToken(parsed.data.refreshToken);

  if (!rotated) {
    return fail("Invalid refresh token", 401);
  }

  return ok("Token refreshed", rotated);
}
