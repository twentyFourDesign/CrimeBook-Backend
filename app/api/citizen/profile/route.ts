import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { buildAppUserPayload } from "@/src/lib/auth/app-user";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  avatarUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  phone: z.union([z.string().max(40), z.literal(""), z.null()]).optional(),
  city: z.union([z.string().max(200), z.literal(""), z.null()]).optional(),
  homeAddress: z.union([z.string().max(500), z.literal(""), z.null()]).optional(),
  homeLatitude: z.union([z.number().min(-90).max(90), z.null()]).optional(),
  homeLongitude: z.union([z.number().min(-180).max(180), z.null()]).optional(),
  occupation: z.union([z.string().max(200), z.literal(""), z.null()]).optional(),
  preferredLanguage: z.string().min(2).max(16).optional(),
});

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      avatarUrl: true,
      phone: true,
      city: true,
      trustScore: true,
      reputationPoints: true,
      citizenProfile: {
        select: {
          homeAddress: true,
          homeLatitude: true,
          homeLongitude: true,
          occupation: true,
          preferredLanguage: true,
        },
      },
    },
  });

  if (!row) {
    return fail("User not found", 404);
  }

  return ok("Profile", {
    profile: {
      id: row.id,
      email: row.email,
      name: row.name,
      username: row.username,
      avatarUrl: row.avatarUrl,
      phone: row.phone,
      city: row.city,
      trustScore: row.trustScore,
      reputationPoints: row.reputationPoints,
      citizenProfile: row.citizenProfile,
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
    return fail("Validation failed", 400, parsed.error.flatten());
  }

  const d = parsed.data;

  if (d.phone !== undefined && d.phone !== null && String(d.phone).trim() !== "") {
    const normalized = String(d.phone).trim();
    const taken = await prisma.user.findFirst({
      where: { phone: normalized, NOT: { id: user.id } },
      select: { id: true },
    });
    if (taken) {
      return fail("This phone number is already linked to another account.", 409);
    }
  }

  const phoneVal =
    d.phone === undefined ? undefined : d.phone === "" || d.phone === null ? null : String(d.phone).trim();
  const cityVal =
    d.city === undefined ? undefined : d.city === "" || d.city === null ? null : String(d.city).trim();
  const avatarVal =
    d.avatarUrl === undefined ? undefined : d.avatarUrl === "" || d.avatarUrl === null ? null : d.avatarUrl;

  await prisma.$transaction(async (tx) => {
    const userData: {
      name?: string;
      avatarUrl?: string | null;
      phone?: string | null;
      city?: string | null;
    } = {};
    if (d.name !== undefined) userData.name = d.name;
    if (d.avatarUrl !== undefined) userData.avatarUrl = avatarVal ?? null;
    if (d.phone !== undefined) userData.phone = phoneVal ?? null;
    if (d.city !== undefined) userData.city = cityVal ?? null;

    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: userData,
      });
    }

    const hasCitizen =
      d.homeAddress !== undefined ||
      d.homeLatitude !== undefined ||
      d.homeLongitude !== undefined ||
      d.occupation !== undefined ||
      d.preferredLanguage !== undefined;

    if (hasCitizen) {
      const existing = await tx.citizenProfile.findUnique({ where: { userId: user.id } });
      const cpData: {
        homeAddress?: string | null;
        homeLatitude?: number | null;
        homeLongitude?: number | null;
        occupation?: string | null;
        preferredLanguage?: string;
      } = {};

      if (d.homeAddress !== undefined) {
        cpData.homeAddress =
          d.homeAddress === "" || d.homeAddress === null ? null : String(d.homeAddress).trim();
      }
      if (d.homeLatitude !== undefined) cpData.homeLatitude = d.homeLatitude;
      if (d.homeLongitude !== undefined) cpData.homeLongitude = d.homeLongitude;
      if (d.occupation !== undefined) {
        cpData.occupation = d.occupation === "" || d.occupation === null ? null : String(d.occupation).trim();
      }
      if (d.preferredLanguage !== undefined) cpData.preferredLanguage = d.preferredLanguage;

      if (existing) {
        await tx.citizenProfile.update({
          where: { userId: user.id },
          data: cpData,
        });
      } else {
        await tx.citizenProfile.create({
          data: {
            userId: user.id,
            homeAddress: cpData.homeAddress ?? null,
            homeLatitude: cpData.homeLatitude ?? null,
            homeLongitude: cpData.homeLongitude ?? null,
            occupation: cpData.occupation ?? null,
            preferredLanguage: cpData.preferredLanguage ?? "en",
          },
        });
      }
    }
  });

  const appUser = await buildAppUserPayload(user.id);
  if (!appUser) {
    return fail("User not found", 404);
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      avatarUrl: true,
      phone: true,
      city: true,
      trustScore: true,
      reputationPoints: true,
      citizenProfile: {
        select: {
          homeAddress: true,
          homeLatitude: true,
          homeLongitude: true,
          occupation: true,
          preferredLanguage: true,
        },
      },
    },
  });

  return ok("Profile updated", { user: appUser, profile: full });
}
