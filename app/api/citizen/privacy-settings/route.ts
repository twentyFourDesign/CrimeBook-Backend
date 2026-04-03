import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const patchSchema = z.object({
  defaultAnonymousReporting: z.boolean().optional(),
  locationSharingEnabled: z.boolean().optional(),
  locationPrecision: z.enum(["exact", "approximate"]).optional(),
  profileVisibility: z.enum(["public", "members", "private"]).optional(),
});

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  let settings = await prisma.privacySettings.findUnique({
    where: { userId: user.id },
  });

  if (!settings) {
    settings = await prisma.privacySettings.create({
      data: { userId: user.id },
    });
  }

  return ok("Privacy settings", {
    settings: {
      defaultAnonymousReporting: settings.defaultAnonymousReporting,
      locationSharingEnabled: settings.locationSharingEnabled,
      locationPrecision: settings.locationPrecision,
      profileVisibility: settings.profileVisibility,
      dataRetentionConsentAt: settings.dataRetentionConsentAt?.toISOString() ?? null,
    },
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

  const settings = await prisma.privacySettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      ...parsed.data,
    },
    update: parsed.data,
  });

  return ok("Privacy updated", {
    settings: {
      defaultAnonymousReporting: settings.defaultAnonymousReporting,
      locationSharingEnabled: settings.locationSharingEnabled,
      locationPrecision: settings.locationPrecision,
      profileVisibility: settings.profileVisibility,
    },
  });
}
