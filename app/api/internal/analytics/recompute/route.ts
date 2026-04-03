import { NextRequest } from "next/server";
import { runAnalyticsComputation } from "@/src/lib/analytics/compute";
import { fail, ok } from "@/src/lib/http/response";

/**
 * Secured trigger for analytics batch (e.g. Vercel cron). Set INTERNAL_ANALYTICS_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.INTERNAL_ANALYTICS_SECRET;
  if (!secret) {
    return fail("Analytics recompute not configured", 503);
  }

  const header = request.headers.get("x-internal-secret");
  if (header !== secret) {
    return fail("Unauthorized", 401);
  }

  try {
    const result = await runAnalyticsComputation();
    return ok("Analytics recomputed", result);
  } catch (e) {
    console.error("[internal/analytics/recompute]", e);
    return fail(e instanceof Error ? e.message : "Recompute failed", 500);
  }
}
