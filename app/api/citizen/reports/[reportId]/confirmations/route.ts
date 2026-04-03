import { NextRequest } from "next/server";
import { z } from "zod";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { awardPoints } from "@/src/lib/gamification/award";
import { prisma } from "@/src/lib/prisma";

const postSchema = z.object({
  isConfirmed: z.boolean(),
  comment: z.string().max(2000).optional(),
});

type RouteContext = { params: Promise<{ reportId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { reportId } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));

  const report = await prisma.incidentReport.findFirst({
    where: { id: reportId, deletedAt: null },
    select: { id: true },
  });
  if (!report) {
    return fail("Report not found", 404);
  }

  const rows = await prisma.reportConfirmation.findMany({
    where: { reportId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  return ok("Confirmations", {
    items: rows.map((r) => ({
      id: r.id,
      isConfirmed: r.isConfirmed,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      user: {
        id: r.user.id,
        displayName: r.user.name.split(/\s+/)[0] ?? "Member",
      },
    })),
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  const { reportId } = await context.params;

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

  const { isConfirmed, comment } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const report = await tx.incidentReport.findFirst({
        where: { id: reportId, deletedAt: null },
        select: { id: true, reporterId: true },
      });
      if (!report) {
        return { type: "not_found" as const };
      }

      if (report.reporterId === user.id && isConfirmed) {
        return { type: "own_report_confirm" as const };
      }

      await tx.reportConfirmation.upsert({
        where: {
          reportId_userId: {
            reportId,
            userId: user.id,
          },
        },
        create: {
          reportId,
          userId: user.id,
          isConfirmed,
          comment: comment?.trim() || null,
        },
        update: {
          isConfirmed,
          comment: comment?.trim() || null,
        },
      });

      const confirmCount = await tx.reportConfirmation.count({
        where: { reportId, isConfirmed: true },
      });

      await tx.incidentReport.update({
        where: { id: reportId },
        data: { communityConfirmCount: confirmCount },
      });

      return { type: "ok" as const, communityConfirmCount: confirmCount };
    });

    if (result.type === "not_found") {
      return fail("Report not found", 404);
    }
    if (result.type === "own_report_confirm") {
      return fail("You cannot confirm your own report", 403);
    }

    if (isConfirmed) {
      await awardPoints({
        userId: user.id,
        points: 5,
        reason: "Community report confirmation",
        referenceId: `report_confirm:${reportId}:${user.id}`,
      });
    }

    return ok("Confirmation saved", {
      communityConfirmCount: result.communityConfirmCount,
    });
  } catch (e) {
    console.error("[confirmations POST]", e);
    return fail("Could not save confirmation", 500);
  }
}
