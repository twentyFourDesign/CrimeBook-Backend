import { NextRequest } from "next/server";
import { SosStatus, UserRole } from "@prisma/client";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (user.role !== UserRole.POLICE_OFFICER && user.role !== UserRole.POLICE_COMMAND) {
    return fail("Forbidden", 403);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 50));

  const alerts = await prisma.sosAlert.findMany({
    where: { status: SosStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          phone: true,
        },
      },
      liveLocationLogs: {
        orderBy: { loggedAt: "desc" },
        take: 1,
      },
    },
  });

  return ok("Active SOS", {
    alerts: alerts.map((a) => ({
      id: a.id,
      latitude: a.latitude,
      longitude: a.longitude,
      isSilent: a.isSilent,
      audioClipUrl: a.audioClipUrl,
      notifiedCount: a.notifiedCount,
      createdAt: a.createdAt.toISOString(),
      user: {
        id: a.user.id,
        name: a.user.name,
        phone: a.user.phone,
      },
      latestLocation: a.liveLocationLogs[0]
        ? {
            latitude: a.liveLocationLogs[0].latitude,
            longitude: a.liveLocationLogs[0].longitude,
            accuracy: a.liveLocationLogs[0].accuracy,
            loggedAt: a.liveLocationLogs[0].loggedAt.toISOString(),
          }
        : null,
    })),
  });
}
