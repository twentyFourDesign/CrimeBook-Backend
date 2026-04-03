import { NextRequest } from "next/server";
import {
  CaseStatus,
  ReportStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { requireUser, requireRole } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";

const USER_ROLES = Object.values(UserRole);
const USER_STATUSES = Object.values(UserStatus);
const REPORT_STATUSES = Object.values(ReportStatus);
const CASE_STATUSES = Object.values(CaseStatus);

export async function GET(request: NextRequest) {
  try {
    const { error, user } = await requireUser(request);
    if (error || !user) {
      return fail(error ?? "Unauthorized", 401);
    }

    if (!requireRole(user, [UserRole.SYSTEM_ADMIN])) {
      return fail("Forbidden", 403);
    }

    const userBase: Prisma.UserWhereInput = { deletedAt: null };

    const [
      roleCounts,
      statusCounts,
      reportStatusCounts,
      caseStatusCounts,
      pendingCommunity,
      pendingPolice,
      totalUsers,
      totalReports,
      totalCases,
    ] = await Promise.all([
      Promise.all(
        USER_ROLES.map(async (role) => ({
          role,
          count: await prisma.user.count({ where: { ...userBase, role } }),
        }))
      ),
      Promise.all(
        USER_STATUSES.map(async (status) => ({
          status,
          count: await prisma.user.count({ where: { ...userBase, status } }),
        }))
      ),
      Promise.all(
        REPORT_STATUSES.map(async (status) => ({
          status,
          count: await prisma.incidentReport.count({ where: { deletedAt: null, status } }),
        }))
      ),
      Promise.all(
        CASE_STATUSES.map(async (status) => ({
          status,
          count: await prisma.caseFile.count({ where: { status } }),
        }))
      ),
      prisma.communityVerification.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      prisma.policeOfficerApplication.count({
        where: { verificationStatus: VerificationStatus.PENDING },
      }),
      prisma.user.count({ where: userBase }),
      prisma.incidentReport.count({ where: { deletedAt: null } }),
      prisma.caseFile.count(),
    ]);

    const byRole = Object.fromEntries(roleCounts.map((r) => [r.role, r.count])) as Record<string, number>;
    const byUserStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.count])) as Record<
      string,
      number
    >;
    const byReportStatus = Object.fromEntries(
      reportStatusCounts.map((r) => [r.status, r.count])
    ) as Record<string, number>;
    const byCaseStatus = Object.fromEntries(
      caseStatusCounts.map((r) => [r.status, r.count])
    ) as Record<string, number>;

    return ok("Stats", {
      users: {
        total: totalUsers,
        byRole,
        byStatus: byUserStatus,
      },
      incidents: {
        total: totalReports,
        byStatus: byReportStatus,
      },
      cases: {
        total: totalCases,
        byStatus: byCaseStatus,
      },
      verifications: {
        pendingCommunity,
        pendingPolice,
      },
    });
  } catch (e) {
    console.error("[admin/stats]", e);
    return fail(e instanceof Error ? e.message : "Failed to load stats", 500);
  }
}
