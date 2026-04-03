import { NextRequest } from "next/server";
import { SosStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const postSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        phone: z.string().min(5).max(40),
        email: z.string().email().optional().nullable(),
      })
    )
    .min(1)
    .max(20),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Attach emergency contacts to an active SOS (stub notification: bump notifiedCount). */
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
    select: { id: true, status: true, notifiedCount: true },
  });

  if (!sos) {
    return fail("SOS not found", 404);
  }

  if (sos.status !== SosStatus.ACTIVE) {
    return fail("SOS is not active", 400);
  }

  const rows = await prisma.$transaction(async (tx) => {
    const created = await Promise.all(
      parsed.data.contacts.map((c) =>
        tx.sosEmergencyContact.create({
          data: {
            userId: user.id,
            sosId,
            name: c.name.trim(),
            phone: c.phone.trim(),
            email: c.email?.trim() || undefined,
            notifiedAt: new Date(),
          },
        })
      )
    );

    await tx.sosAlert.update({
      where: { id: sosId },
      data: {
        notifiedCount: sos.notifiedCount + created.length,
      },
    });

    return created;
  });

  return ok("Contacts attached", {
    contactIds: rows.map((r) => r.id),
    notifiedCount: sos.notifiedCount + rows.length,
  });
}
