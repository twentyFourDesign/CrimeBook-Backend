import { NextRequest } from "next/server";
import { SosStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const patchSchema = z.object({
  status: z.literal("RESPONDED"),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Officer marks an SOS as responded / cleared. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.POLICE_OFFICER && user.role !== UserRole.POLICE_COMMAND) {
    return fail("Forbidden", 403);
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

  const sos = await prisma.sosAlert.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!sos) {
    return fail("SOS not found", 404);
  }

  if (sos.status !== SosStatus.ACTIVE) {
    return fail("SOS is not active", 400);
  }

  const updated = await prisma.sosAlert.update({
    where: { id },
    data: {
      status: SosStatus.RESPONDED,
      resolvedAt: new Date(),
      resolvedById: user.id,
    },
  });

  return ok("SOS resolved", {
    sosId: updated.id,
    status: updated.status,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
  });
}
