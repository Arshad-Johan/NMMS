import "dotenv/config";
import { prisma } from "./index";

async function main() {
  const updated = await prisma.session.updateMany({
    data: { isPublished: true },
  });
  console.log("Updated sessions count:", updated);

  const sessions = await prisma.session.findMany({
    include: { categoryRules: true },
  });
  console.log("All sessions in DB:", JSON.stringify(sessions, null, 2));

  const teacher = await prisma.teacher.findFirst({
    where: { mobile: "6379931029" },
    include: { school: true },
  });
  console.log("Test teacher school & category:", teacher);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
