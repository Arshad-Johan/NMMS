/**
 * Seed script — imports data from the three Excel files into Neon via Prisma.
 *
 * Run with:  npm run db:seed
 *
 * Files expected in project root:
 *   - NMMS MADURAI EDU (2)-1.xlsx        (Madurai education district)
 *   - NMMS Melur Edu Dist (10)-1.xlsx    (Melur education district)
 *   - all school HM & Mobile No (1).xlsx (HOS / head master data)
 *
 * Strategy: all inserts are batched via Prisma's createMany + skipDuplicates
 * (schools/HOS stubs) or upsert loops (teachers/HOS) to stay idempotent.
 */
import "dotenv/config";
import path from "path";
import * as XLSX from "xlsx";
import { prisma } from "./index";
import { SchoolType, CategoryType, HosType } from "@prisma/client";

const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "None" ? null : s;
}

function cleanMobile(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  return s.replace(/\D/g, "").slice(-10) || null;
}

function cleanInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n);
}

function normalizeBlock(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bt\b\./gi, "T.");
}

function normalizeSchoolType(v: unknown): SchoolType | null {
  const s = clean(v)?.toLowerCase() ?? "";
  if (s.includes("government")) return SchoolType.Government;
  if (s.includes("corporation")) return SchoolType.Corporation;
  if (s.includes("aided")) return SchoolType.Aided;
  return null;
}

function normalizeCategoryType(v: unknown): CategoryType | null {
  const s = clean(v)?.toLowerCase() ?? "";
  if (s.includes("higher") || s.includes("hr sec"))
    return CategoryType.Higher_Secondary_School;
  if (s.includes("high") && !s.includes("higher")) return CategoryType.High_School;
  if (s.includes("middle")) return CategoryType.Middle_School;
  return null;
}

function normalizeHosType(v: unknown): HosType {
  const s = clean(v) ?? "";
  if (s.includes("Asst") || s.includes("Vice"))
    return HosType.Asst_Head_Master_Vice_Principal;
  if (s.includes("Acting")) return HosType.Acting_Head_Teacher;
  if (s.includes("other school")) return HosType.Incharge_from_other_school;
  if (s.includes("Block") || s.includes("District"))
    return HosType.Incharge_from_Block_District;
  if (s.includes("Others")) return HosType.Others;
  return HosType.Head_Master_Principal;
}

function loadSheet(filePath: string, sheetName: string) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in ${filePath}`);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
}

function chunks<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedNmmsFile(filePath: string, educationDistrict: string) {
  const rows = loadSheet(filePath, "Sheet1");
  console.log(`  Found ${rows.length} rows in ${path.basename(filePath)}`);

  type SchoolData = {
    udise: string;
    name: string;
    educationDistrict: string;
    block: string | null;
    schoolType: SchoolType | null;
    categoryType: CategoryType | null;
    class8Boys: number | null;
    class8Girls: number | null;
    class8Total: number | null;
    willingStudents: number | null;
  };

  type TeacherData = {
    schoolUdise: string;
    name: string | null;
    mobile: string;
    subject: string | null;
  };

  const schoolMap = new Map<string, SchoolData>();
  const teacherMap = new Map<string, TeacherData>();

  for (const row of rows) {
    const udise = clean(row["UDISE"] ?? row["UDISE Code"] ?? row["Udise"]);
    const schoolName = clean(row["School Name"]);
    if (!udise || !schoolName) continue;

    schoolMap.set(udise, {
      udise,
      name: schoolName,
      educationDistrict,
      block: normalizeBlock(row["Block"]),
      schoolType: normalizeSchoolType(row["School Type"]),
      categoryType: normalizeCategoryType(row["Category Type"]),
      class8Boys: cleanInt(row["Class8 Boys"]),
      class8Girls: cleanInt(row["Class8 Girls"]),
      class8Total: cleanInt(row["Class8 Total"]),
      willingStudents: cleanInt(row["No of Willing Students"]),
    });

    const mobile = cleanMobile(
      row["NMMS Incharge Teacher Mobile No."] ??
        row["NMMS Incharge Teacher Mobile No"]
    );
    if (mobile) {
      teacherMap.set(mobile, {
        schoolUdise: udise,
        name: clean(
          row["NMMS Incharge Teacher Name"] ?? row["NMMS Incharge Teacher Name "]
        ),
        mobile,
        subject: clean(row["NMMS Incharge Teachers Subject"]),
      });
    }
  }

  const schoolList = [...schoolMap.values()];
  const teacherList = [...teacherMap.values()];

  // Upsert schools in batches using createMany + individual upsert for updates
  console.log(`  Upserting ${schoolList.length} schools...`);
  for (const batch of chunks(schoolList, BATCH_SIZE)) {
    await Promise.all(
      batch.map((s) =>
        prisma.school.upsert({
          where: { udise: s.udise },
          create: s,
          update: {
            block: s.block,
            schoolType: s.schoolType,
            categoryType: s.categoryType,
            class8Boys: s.class8Boys,
            class8Girls: s.class8Girls,
            class8Total: s.class8Total,
            willingStudents: s.willingStudents,
          },
        })
      )
    );
  }
  console.log(`  ✓ Schools done.`);

  console.log(`  Upserting ${teacherList.length} teachers...`);
  for (const batch of chunks(teacherList, BATCH_SIZE)) {
    await Promise.all(
      batch.map((t) =>
        prisma.teacher.upsert({
          where: { mobile: t.mobile },
          create: t,
          update: {
            name: t.name,
            subject: t.subject,
            schoolUdise: t.schoolUdise,
          },
        })
      )
    );
  }
  console.log(`  ✓ Teachers done.`);
}

async function seedHosFile(filePath: string) {
  const rows = loadSheet(filePath, "School Profile Full Report");
  console.log(`  Found ${rows.length} rows in ${path.basename(filePath)}`);

  type HosData = {
    schoolUdise: string;
    hosType: HosType;
    name: string | null;
    mobile: string | null;
    email: string | null;
  };

  const schoolStubMap = new Map<string, string>(); // udise -> name
  const hosMap = new Map<string, HosData>();

  for (const row of rows) {
    const udise = clean(row["UDISE_Code"]);
    if (!udise) continue;

    schoolStubMap.set(udise, clean(row["School_Name"]) ?? "Unknown");
    hosMap.set(udise, {
      schoolUdise: udise,
      hosType: normalizeHosType(row["Hos/In-Charge_Type"]),
      name: clean(row["Hos/In-Charge_Name"]),
      mobile: cleanMobile(row["Mobile_(HOS)"]),
      email: clean(row["HOS_Email"]),
    });
  }

  const stubs = [...schoolStubMap.entries()];
  const hosList = [...hosMap.values()];

  // Ensure school stubs exist (skip if already present from NMMS files)
  console.log(`  Ensuring ${stubs.length} school stubs exist...`);
  for (const batch of chunks(stubs, BATCH_SIZE)) {
    await prisma.school.createMany({
      data: batch.map(([udise, name]) => ({ udise, name })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ School stubs done.`);

  console.log(`  Upserting ${hosList.length} HOS records...`);
  for (const batch of chunks(hosList, BATCH_SIZE)) {
    await Promise.all(
      batch.map((h) =>
        prisma.headOfSchool.upsert({
          where: { schoolUdise: h.schoolUdise },
          create: h,
          update: {
            hosType: h.hosType,
            name: h.name,
            mobile: h.mobile,
            email: h.email,
          },
        })
      )
    );
  }
  console.log(`  ✓ HOS done.`);
}

// ---------------------------------------------------------------------------
// Seed NMMS INCHARGE file (flat format: Teacher Name, Mobile Number, etc.)
// ---------------------------------------------------------------------------

async function seedInchargeFile(filePath: string) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0]; // Use whatever the first sheet is
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`No sheet found in ${filePath}`);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
  console.log(`  Found ${rows.length} rows in ${path.basename(filePath)} (sheet: ${sheetName})`);

  type SchoolData = {
    udise: string;
    name: string;
    educationDistrict: string | null;
    block: string | null;
    categoryType: CategoryType | null;
  };

  type TeacherData = {
    schoolUdise: string;
    name: string | null;
    mobile: string;
    subject: string | null;
  };

  const schoolMap = new Map<string, SchoolData>();
  const teacherMap = new Map<string, TeacherData>();

  for (const row of rows) {
    const udise = clean(row["UDISE Code"]);
    const schoolName = clean(row["School Name"])?.replace(/\r\n/g, " ").replace(/\s+/g, " ").trim() ?? null;
    if (!udise || !schoolName) continue;

    schoolMap.set(udise, {
      udise,
      name: schoolName,
      educationDistrict: clean(row["District"]),
      block: normalizeBlock(row["Block"]),
      categoryType: normalizeCategoryType(row["School Category"]),
    });

    const mobile = cleanMobile(row["Mobile Number"]);
    if (mobile) {
      teacherMap.set(mobile, {
        schoolUdise: udise,
        name: clean(row["Teacher Name"]),
        mobile,
        subject: clean(row["Subject / Role"]),
      });
    }
  }

  const schoolList = [...schoolMap.values()];
  const teacherList = [...teacherMap.values()];

  // Upsert schools
  console.log(`  Upserting ${schoolList.length} schools...`);
  for (const batch of chunks(schoolList, BATCH_SIZE)) {
    await Promise.all(
      batch.map((s) =>
        prisma.school.upsert({
          where: { udise: s.udise },
          create: {
            udise: s.udise,
            name: s.name,
            educationDistrict: s.educationDistrict,
            block: s.block,
            categoryType: s.categoryType,
          },
          update: {
            block: s.block,
            categoryType: s.categoryType,
          },
        })
      )
    );
  }
  console.log(`  ✓ Schools done.`);

  // Upsert teachers
  console.log(`  Upserting ${teacherList.length} teachers...`);
  for (const batch of chunks(teacherList, BATCH_SIZE)) {
    await Promise.all(
      batch.map((t) =>
        prisma.teacher.upsert({
          where: { mobile: t.mobile },
          create: t,
          update: {
            name: t.name,
            subject: t.subject,
            schoolUdise: t.schoolUdise,
          },
        })
      )
    );
  }
  console.log(`  ✓ Teachers done.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const root = path.resolve(process.cwd());

  console.log("\n🌱 Seeding Madurai Education District...");
  await seedNmmsFile(path.join(root, "NMMS MADURAI EDU (2)-1.xlsx"), "Madurai");

  console.log("\n🌱 Seeding Melur Education District...");
  await seedNmmsFile(
    path.join(root, "NMMS Melur Edu Dist (10)-1.xlsx"),
    "Melur"
  );

  console.log("\n🌱 Seeding Head of Schools data...");
  await seedHosFile(path.join(root, "all school HM & Mobile No (1).xlsx"));

  console.log("\n🌱 Seeding Middle School Incharges...");
  try {
    await seedInchargeFile(path.join(root, "NMMS INCHARGE.xlsx"));
  } catch (e: any) {
    console.log("Middle school incharge file missing or failed to parse:", e.message);
  }

  console.log("\n✅ Seed complete!");
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Seed failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
