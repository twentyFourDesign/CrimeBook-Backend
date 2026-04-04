import { prisma } from "../src/lib/prisma";
import { awardBadgeIfEligible } from "../src/lib/gamification/badges";

async function retroactiveAward() {
  console.log("Starting retroactive badge awarding...");

  // Find users who have at least one report but NO 'First Responder' badge
  const usersWithReports = await prisma.user.findMany({
    where: {
      reports: { some: { deletedAt: null } },
      badges: { none: { badge: { criteria: "SUBMITTED_1_REPORT" } } },
    },
    select: { id: true, email: true },
  });

  console.log(`Found ${usersWithReports.length} users with missing badges.`);

  for (const user of usersWithReports) {
    console.log(`Awarding badge to user: ${user.email} (${user.id})`);
    const res = await awardBadgeIfEligible(user.id, "SUBMITTED_1_REPORT");
    if (res.awarded) {
      console.log(`Successfully awarded badge to ${user.email}`);
    } else {
      const errorMsg = (res as any).error || (res as any).message || "Unknown reason";
      console.log(`Failed to award badge to ${user.email}: ${errorMsg}`);
    }
  }

  console.log("Retroactive award complete.");
}

retroactiveAward()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
