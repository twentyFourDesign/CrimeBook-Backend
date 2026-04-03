import { NextRequest } from "next/server";
import { GroupRole } from "@prisma/client";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { distanceKm } from "@/src/lib/geo/distance";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const postSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  radiusKm: z.number().positive().max(100).optional(),
});

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const radiusKm = Math.min(200, Math.max(1, Number(searchParams.get("radiusKm")) || 25));

  const groups = await prisma.communityGroup.findMany({
    where: { isActive: true },
    orderBy: { memberCount: "desc" },
    take: 200,
  });

  let items = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    avatarUrl: g.avatarUrl,
    latitude: g.latitude,
    longitude: g.longitude,
    radiusKm: g.radiusKm,
    memberCount: g.memberCount,
    createdAt: g.createdAt.toISOString(),
  }));

  if (latRaw != null && lngRaw != null && latRaw !== "" && lngRaw !== "") {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return fail("lat and lng must be valid numbers", 400);
    }
    items = items.filter((g) => distanceKm(lat, lng, g.latitude, g.longitude) <= radiusKm);
  }

  return ok("Groups", { groups: items });
}

export async function POST(request: NextRequest) {
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

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return fail("Invalid body", 400, parsed.error.flatten());
  }

  const { name, description, avatarUrl, latitude, longitude, radiusKm } = parsed.data;

  try {
    const group = await prisma.$transaction(async (tx) => {
      const g = await tx.communityGroup.create({
        data: {
          name: name.trim(),
          description: description?.trim() || undefined,
          avatarUrl: avatarUrl ?? undefined,
          latitude,
          longitude,
          radiusKm: radiusKm ?? 2,
          memberCount: 1,
        },
      });
      await tx.communityGroupMember.create({
        data: {
          groupId: g.id,
          userId: user.id,
          role: GroupRole.OWNER,
        },
      });
      return g;
    });

    return ok("Group created", {
      group: {
        id: group.id,
        name: group.name,
        memberCount: group.memberCount,
      },
    });
  } catch (e) {
    console.error("[community/groups POST]", e);
    return fail("Could not create group", 500);
  }
}
