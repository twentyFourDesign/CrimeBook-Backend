import { NextRequest } from "next/server";
import { getBearerToken } from "@/src/lib/auth/request";
import { verifyAccessToken } from "@/src/lib/auth/jwt";
import { buildAppUserPayload } from "@/src/lib/auth/app-user";
import { fail, ok } from "@/src/lib/http/response";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return fail("Missing access token", 401);
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await buildAppUserPayload(payload.sub);

    if (!user) {
      return fail("User not found", 404);
    }

    return ok("Current user fetched", { user });
  } catch {
    return fail("Invalid access token", 401);
  }
}
