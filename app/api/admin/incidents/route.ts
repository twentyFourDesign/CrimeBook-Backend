import { NextRequest } from "next/server";
import { CrimeCategory, Prisma, ReportStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
  status: z.nativeEnum(ReportStatus).optional(),
  crimeCategory: z.nativeEnum(CrimeCategory).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  if (!requireRole(user, [UserRole.SYSTEM_ADMIN])) {
    return fail("Forbidden", 403);
  }

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("pageSize") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    crimeCategory: searchParams.get("crimeCategory") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return fail("Invalid query", 400, parsed.error.flatten());
  }

  const { page, pageSize, status, crimeCategory, from, to } = parsed.data;
  const skip = (page - 1) * pageSize;

  const where: Prisma.IncidentReportWhereInput = { deletedAt: null };

  if (status) where.status = status;
  if (crimeCategory) where.crimeCategory = crimeCategory;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const [rows, total] = await Promise.all([
    prisma.incidentReport.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        crimeCategory: true,
        title: true,
        status: true,
        visibility: true,
        isAnonymous: true,
        latitude: true,
        longitude: true,
        locationAddress: true,
        locationLabel: true,
        caseId: true,
        createdAt: true,
        reporter: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.incidentReport.count({ where }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    crimeCategory: r.crimeCategory,
    title: r.title,
    status: r.status,
    visibility: r.visibility,
    isAnonymous: r.isAnonymous,
    latitude: r.latitude,
    longitude: r.longitude,
    locationAddress: r.locationAddress,
    locationLabel: r.locationLabel,
    caseId: r.caseId,
    createdAt: r.createdAt.toISOString(),
    reporter: r.isAnonymous
      ? null
      : r.reporter
        ? { id: r.reporter.id, name: r.reporter.name, email: r.reporter.email }
        : null,
  }));

  return ok("Incidents", {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
