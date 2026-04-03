import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const patchSchema = z.object({
  radiusKm: z.number().positive().max(100),
});

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  let row = await prisma.safetyRadiusSetting.findUnique({
    where: { userId: user.id },
  });
  if (!row) {
    row = await prisma.safetyRadiusSetting.create({
      data: { userId: user.id },
    });
  }

  return ok("Safety radius", {
    radiusKm: row.radiusKm,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PATCH(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

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

  const row = await prisma.safetyRadiusSetting.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      radiusKm: parsed.data.radiusKm,
    },
    update: { radiusKm: parsed.data.radiusKm },
  });

  return ok("Safety radius updated", {
    radiusKm: row.radiusKm,
    updatedAt: row.updatedAt.toISOString(),
  });
}
