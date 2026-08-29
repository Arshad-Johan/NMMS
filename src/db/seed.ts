/**
 * Seed script — imports school data purely from Enroll List.xlsx into Neon via Prisma.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import path from "path";
import * as XLSX from "xlsx";
import { prisma } from "./index";
import { CategoryType } from "@prisma/client";

const BATCH_SIZE = 100;

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "None" ? null : s;
}

function parseCategoryType(v: unknown): CategoryType | null {
  const s = clean(v);
  if (!s) return null;
  if (s === "Primary School") return CategoryType.Primary_School;
  if (s === "Middle School") return CategoryType.Middle_School;
  if (s === "High School") return CategoryType.High_School;
  if (s === "Higher Secondary School") return CategoryType.Higher_Secondary_School;
  if (s === "Pre-Primary School") return CategoryType.Pre_Primary_School;
  return null;
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

async function seedEnrollList(filePath: string) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`No sheet found in ${filePath}`);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
  console.log(`  Found ${rows.length} school rows in ${path.basename(filePath)}`);

  type SchoolData = {
    udise: string;
    name: string;
    district: string | null;
    educationDistrict: string | null;
    block: string | null;
    schoolType: string | null;
    management: string | null;
    category: string | null;
    categoryType: CategoryType | null;
  };

  const schoolMap = new Map<string, SchoolData>();

  for (const row of rows) {
    const rawUdise = clean(row["UDISE"]);
    const rawName = clean(row["School_Name"]);
    if (!rawUdise || !rawName) continue;

    const udise = String(rawUdise).padStart(11, "0");

    schoolMap.set(udise, {
      udise,
      name: rawName,
      district: clean(row["District"]),
      educationDistrict: clean(row["Education_District"]),
      block: clean(row["Block"]),
      schoolType: clean(row["School_Type"]),
      management: clean(row["Manangement"]),
      category: clean(row["Category"]),
      categoryType: parseCategoryType(row["Category_Type"]),
    });
  }

  const schoolList = [...schoolMap.values()];

  console.log(`🧹 Clearing old school-dependent data & schools from DB...`);
  await prisma.attendance.deleteMany();
  await prisma.meetLink.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.headOfSchool.deleteMany();
  await prisma.school.deleteMany();

  console.log(`🌱 Inserting ${schoolList.length} schools from Enroll List.xlsx into DB...`);
  for (const batch of chunks(schoolList, BATCH_SIZE)) {
    await prisma.school.createMany({
      data: batch,
      skipDuplicates: true,
    });
  }
  console.log(`✅ ${schoolList.length} schools imported successfully!`);
}

async function main() {
  const root = path.resolve(process.cwd());
  const filePath = path.join(root, "Enroll List.xlsx");

  console.log("\n🚀 Starting DB Seed process using Enroll List.xlsx...");
  await seedEnrollList(filePath);

  console.log("\n✅ Database sync complete!");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
