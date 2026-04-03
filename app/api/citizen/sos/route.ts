import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const postSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  isSilent: z.boolean().optional(),
  audioClipUrl: z.string().url().optional().nullable(),
});

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

  const { latitude, longitude, isSilent, audioClipUrl } = parsed.data;

  try {
    const alert = await prisma.sosAlert.create({
      data: {
        userId: user.id,
        latitude,
        longitude,
        isSilent: isSilent ?? false,
        audioClipUrl: audioClipUrl ?? undefined,
      },
    });

    return ok("SOS started", {
      sosId: alert.id,
      status: alert.status,
      createdAt: alert.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("[citizen/sos POST]", e);
    return fail("Could not start SOS", 500);
  }
}
