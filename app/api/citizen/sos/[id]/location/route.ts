import { NextRequest } from "next/server";
import { SosStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const postSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  accuracy: z.number().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id: sosId } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid body", 400, parsed.error.flatten());
  }

  const sos = await prisma.sosAlert.findFirst({
    where: { id: sosId, userId: user.id },
    select: { id: true, status: true },
  });

  if (!sos) {
    return fail("SOS not found", 404);
  }

  if (sos.status !== SosStatus.ACTIVE) {
    return fail("SOS is not active", 400);
  }

  const { latitude, longitude, accuracy } = parsed.data;

  const log = await prisma.sosLocationLog.create({
    data: {
      sosId,
      latitude,
      longitude,
      accuracy: accuracy ?? undefined,
    },
  });

  return ok("Location logged", {
    logId: log.id,
    loggedAt: log.loggedAt.toISOString(),
  });
}
