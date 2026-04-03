import { NextRequest } from "next/server";
import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  role: z.nativeEnum(UserRole).optional(),
  /** Comma-separated roles, e.g. POLICE_OFFICER,POLICE_COMMAND */
  roles: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  q: z.string().max(200).optional(),
  includeDeleted: z.coerce.boolean().default(false),
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
    role: searchParams.get("role") ?? undefined,
    roles: searchParams.get("roles") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    q: searchParams.get("q") ?? undefined,
    includeDeleted: searchParams.get("includeDeleted") ?? undefined,
  });

  if (!parsed.success) {
    return fail("Invalid query", 400, parsed.error.flatten());
  }

  const { page, pageSize, role, roles: rolesParam, status, q, includeDeleted } = parsed.data;
  const skip = (page - 1) * pageSize;

  const roleInFromParam = rolesParam
    ? (rolesParam
        .split(",")
        .map((x) => x.trim())
        .filter((x): x is UserRole => (Object.values(UserRole) as string[]).includes(x)) as UserRole[])
    : [];

  const where: Prisma.UserWhereInput = {};
  if (!includeDeleted) {
    where.deletedAt = null;
  }
  if (roleInFromParam.length > 0) {
    where.role = { in: roleInFromParam };
  } else if (role) {
    where.role = role;
  }
  if (status) {
    where.status = status;
  }
  if (q?.trim()) {
    const term = q.trim();
    where.OR = [
      { email: { contains: term, mode: "insensitive" } },
      { name: { contains: term, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        deletedAt: true,
        communityVerification: {
          select: { verificationStatus: true },
        },
        policeOfficerApplication: {
          select: { verificationStatus: true, badgeNumber: true, department: true },
        },
        officerProfile: {
          select: {
            badgeNumber: true,
            department: true,
            precinct: true,
            rank: true,
          },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const items = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    username: r.username,
    role: r.role,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    communityVerificationStatus: r.communityVerification?.verificationStatus ?? null,
    policeApplicationStatus: r.policeOfficerApplication?.verificationStatus ?? null,
    policeApplicationBadge: r.policeOfficerApplication?.badgeNumber ?? null,
    policeApplicationDepartment: r.policeOfficerApplication?.department ?? null,
    officerBadge: r.officerProfile?.badgeNumber ?? null,
    officerDepartment: r.officerProfile?.department ?? null,
    officerPrecinct: r.officerProfile?.precinct ?? null,
    officerRank: r.officerProfile?.rank ?? null,
  }));

  return ok("Users", {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}
