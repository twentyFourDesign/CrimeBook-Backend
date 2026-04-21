import { NextRequest } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { fail, ok } from "@/src/lib/http/response";
import { prisma } from "@/src/lib/prisma";
import { UserRole } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { error, user } = await requireUser(request);
  if (error || !user) {
    return fail(error ?? "Unauthorized", 401);
  }

  // 1. Fetch user points and earned badges
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      badges: {
        include: {
          badge: true
        }
      }
    }
  });

  if (!fullUser) return fail("User not found", 404);

  // 2. Calculate current stats for progress bars
  const [reportCount, confirmationCount, solvedCaseCount] = await Promise.all([
    prisma.incidentReport.count({ where: { reporterId: user.id } }),
    prisma.reportConfirmation.count({ where: { userId: user.id, isConfirmed: true } }),
    prisma.caseFile.count({ 
      where: { 
        assignments: { some: { officerId: user.id } },
        status: "CLOSED"
      } 
    })
  ]);

  // 3. Define Achievement Goals with Progress
  const goals = [];

  if (fullUser.role === UserRole.CITIZEN || fullUser.role === UserRole.VERIFIED_COMMUNITY_MEMBER) {
    goals.push(
      {
        id: "first_report",
        title: "First Responder",
        description: "Submit your first incident report",
        current: reportCount,
        target: 1,
        icon: "megaphone-outline",
        type: "CITIZEN"
      },
      {
        id: "active_reporter",
        title: "Active Watchman",
        description: "Submit 5 incident reports",
        current: reportCount,
        target: 5,
        icon: "eye-outline",
        type: "CITIZEN"
      },
      {
        id: "helper_1",
        title: "Community Helper",
        description: "Verify your first neighborhood report",
        current: confirmationCount,
        target: 1,
        icon: "checkmark-circle-outline",
        type: "CITIZEN"
      },
      {
        id: "vigilante",
        title: "Vigilante",
        description: "Verify 10 neighborhood reports",
        current: confirmationCount,
        target: 10,
        icon: "shield-half-outline",
        type: "CITIZEN"
      }
    );
  }

  if (fullUser.role === UserRole.POLICE_OFFICER || fullUser.role === UserRole.POLICE_COMMAND) {
    goals.push(
      {
        id: "case_1",
        title: "Justice Served",
        description: "Successfully close your first case",
        current: solvedCaseCount,
        target: 1,
        icon: "briefcase-outline",
        type: "POLICE"
      },
      {
        id: "veteran_officer",
        title: "Veteran Officer",
        description: "Successfully close 10 cases",
        current: solvedCaseCount,
        target: 10,
        icon: "ribbon-outline",
        type: "POLICE"
      }
    );
  }

  // Calculate percentage and earned status for goals
  const processedGoals = goals.map(g => ({
    ...g,
    progress: Math.min(1, g.current / g.target),
    isEarned: g.current >= g.target
  }));

  return ok("Achievements", {
    reputationPoints: fullUser.reputationPoints,
    trustScore: fullUser.trustScore,
    userBadges: fullUser.badges.map((ub: any) => ({
      id: ub.id,
      earnedAt: ub.earnedAt,
      badge: ub.badge
    })),
    goals: processedGoals
  });
}
