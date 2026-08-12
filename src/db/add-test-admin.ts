/**
 * Seed script — inserts a test Admin user.
 * Run with: npx tsx src/db/add-test-admin.ts
 */
import "dotenv/config";
import { prisma } from "./index";
import { hashPassword } from "../lib/auth";

async function main() {
  const email = "admin@nmms.local";
  const password = "Admin@1234";
  const passwordHash = hashPassword(password);

  const admin = await prisma.user.upsert({
    where: { email },
    create: {
      name: "NMMS Admin",
      email,
      passwordHash,
      role: "admin",
    },
    update: {
      name: "NMMS Admin",
      passwordHash,
      role: "admin",
    },
  });

  console.log("✅ Admin user upserted successfully:");
  console.log(`   Email: ${admin.email}`);
  console.log(`   Password: ${password}`);
  console.log(`   ID: ${admin.id}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("❌ Failed to create admin:", err);
  await prisma.$disconnect();
  process.exit(1);
});
