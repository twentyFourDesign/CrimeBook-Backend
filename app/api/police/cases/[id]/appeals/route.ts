import { NextRequest } from "next/server";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const bodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(8000),
  imageUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v === undefined || v === null ? null : v)),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  radiusKm: z.number().positive().max(500),
  expiresAt: z.string().datetime().optional().nullable(),
});

type RouteContext = { params: Promise<{ id: string }> };

async function canManageAppeals(caseId: string, userId: string, role: UserRole) {
  if (role === UserRole.SYSTEM_ADMIN) {
    const exists = await prisma.caseFile.findUnique({ where: { id: caseId }, select: { id: true } });
    return !!exists;
  }
  if (role === UserRole.POLICE_OFFICER || role === UserRole.POLICE_COMMAND) {
    const a = await prisma.caseAssignment.findFirst({
      where: { caseId, officerId: userId, removedAt: null },
      select: { id: true },
    });
    return !!a;
  }
  return false;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { id: caseId } = await context.params;

  const allowed = await canManageAppeals(caseId, user.id, user.role);
  if (!allowed) {
    return fail("Forbidden", 403);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail("Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid body", 400, parsed.error.flatten());
  }

  const { title, description, imageUrl, latitude, longitude, radiusKm, expiresAt } = parsed.data;

  try {
    const appeal = await prisma.publicAppeal.create({
      data: {
        caseId,
        title: title.trim(),
        description: description.trim(),
        imageUrl: imageUrl ?? undefined,
        latitude,
        longitude,
        radiusKm,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        isActive: true,
      },
    });

    return ok("Appeal created", {
      appeal: {
        id: appeal.id,
        caseId: appeal.caseId,
        title: appeal.title,
        description: appeal.description,
        imageUrl: appeal.imageUrl,
        latitude: appeal.latitude,
        longitude: appeal.longitude,
        radiusKm: appeal.radiusKm,
        isActive: appeal.isActive,
        expiresAt: appeal.expiresAt?.toISOString() ?? null,
        createdAt: appeal.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[appeals POST]", e);
    return fail("Could not create appeal", 500);
  }
}
