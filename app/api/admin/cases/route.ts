import { NextRequest } from "next/server";
import { CaseStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(20),
  status: z.nativeEnum(CaseStatus).optional(),
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
  });

  if (!parsed.success) {
    return fail("Invalid query", 400, parsed.error.flatten());
  }

  const { page, pageSize, status } = parsed.data;
  const skip = (page - 1) * pageSize;

  const where = status ? { status } : {};

  const [rows, total] = await Promise.all([
    prisma.caseFile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        report: {
          select: {
            id: true,
            crimeCategory: true,
            title: true,
            description: true,
            status: true,
            locationLabel: true,
            locationAddress: true,
          },
        },
        assignments: {
          where: { removedAt: null },
          select: {
            isLead: true,
            officer: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    prisma.caseFile.count({ where }),
  ]);

  const items = rows.map((c) => {
    const lead = c.assignments.find((a) => a.isLead) ?? c.assignments[0];
    return {
      id: c.id,
      caseNumber: c.caseNumber,
      status: c.status,
      priority: c.priority,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      reportId: c.report.id,
      report: {
        crimeCategory: c.report.crimeCategory,
        title: c.report.title,
        descriptionPreview: c.report.description.slice(0, 160),
        status: c.report.status,
        locationLabel: c.report.locationLabel,
        locationAddress: c.report.locationAddress,
      },
      assignmentCount: c.assignments.length,
      leadOfficer: lead
        ? { id: lead.officer.id, name: lead.officer.name, email: lead.officer.email }
        : null,
    };
  });

  return ok("Cases", {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
