import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const badges = [
  {
    name: "First Responder",
    description: "Reported your first community incident.",
    iconUrl: "megaphone-outline",
    criteria: "SUBMITTED_1_REPORT",
    pointsValue: 100,
  },
  {
    name: "Citizen Witness",
    description: "Confirmed your first community incident report.",
    iconUrl: "eye-outline",
    criteria: "CONFIRMED_1_REPORT",
    pointsValue: 50,
  },
  {
    name: "Community Guardian",
    description: "Successfully confirmed 10 incident reports.",
    iconUrl: "shield-checkmark-outline",
    criteria: "CONFIRMED_10_REPORTS",
    pointsValue: 500,
  },
  {
    name: "Justice Enforcer",
    description: "Police officer: Successfully resolved your first case.",
    iconUrl: "ribbon-outline",
    criteria: "SOLVED_1_CASE",
    pointsValue: 200,
  },
  {
    name: "Master Detective",
    description: "Police officer: Successfully resolved 10 cases.",
    iconUrl: "trophy-outline",
    criteria: "SOLVED_10_CASES",
    pointsValue: 1000,
  }
];

async function main() {
  console.log("Seeding badges...");
  for (const b of badges) {
    await prisma.badge.upsert({
      where: { name: b.name },
      update: b,
      create: b,
    });
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
