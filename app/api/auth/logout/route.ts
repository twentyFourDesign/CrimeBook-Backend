import { NextRequest } from "next/server";
import { revokeRefreshToken } from "@/src/lib/auth/session";
import { fail, ok } from "@/src/lib/http/response";
import { logoutSchema } from "@/src/lib/validation/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = logoutSchema.safeParse(body);

  if (!parsed.success) {
    return fail("Invalid request body", 400, parsed.error.flatten());
  }

  await revokeRefreshToken(parsed.data.refreshToken);
  return ok("Logged out successfully");
}
