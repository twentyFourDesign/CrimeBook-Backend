import { NextRequest } from "next/server";
import { SosStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const patchSchema = z.object({
  status: z.enum(["CANCELLED", "RESPONDED"]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid body", 400, parsed.error.flatten());
  }

  const sos = await prisma.sosAlert.findFirst({
    where: { id, userId: user.id },
    select: { id: true, status: true },
  });

  if (!sos) {
    return fail("SOS not found", 404);
  }

  if (sos.status !== SosStatus.ACTIVE) {
    return fail("SOS is no longer active", 400);
  }

  const next = parsed.data.status === "CANCELLED" ? SosStatus.CANCELLED : SosStatus.RESPONDED;

  const updated = await prisma.sosAlert.update({
    where: { id },
    data: {
      status: next,
      resolvedAt: new Date(),
      resolvedById: next === SosStatus.RESPONDED ? user.id : null,
    },
  });

  return ok("SOS updated", {
    sosId: updated.id,
    status: updated.status,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
  });
}
