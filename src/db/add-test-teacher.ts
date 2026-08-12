/**
 * One-off script to insert a test teacher record.
 * Run with: npx tsx src/db/add-test-teacher.ts
 */
import "dotenv/config";
import { prisma } from "./index";

async function main() {
  // Pick the first available school as a placeholder
  const school = await prisma.school.findFirst({
    select: { udise: true, name: true },
  });

  if (!school) {
    throw new Error("No schools found in the database. Run the seed first.");
  }

  console.log(`Using school: ${school.name} (${school.udise})`);

  const teacher = await prisma.teacher.upsert({
    where: { mobile: "6379931029" },
    create: {
      schoolUdise: school.udise,
      name: "Test Teacher (Admin)",
      mobile: "6379931029",
      subject: "Testing",
    },
    update: {
      name: "Test Teacher (Admin)",
    },
  });

  console.log("✅ Test teacher upserted:", teacher);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
