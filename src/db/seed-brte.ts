/**
 * Seed script — imports BRTE data from the first sheet of BRTE LIST NEW.xlsx into Neon via Prisma.
 *
 * Run with: npx tsx src/db/seed-brte.ts
 */
import "dotenv/config";
import path from "path";
import * as XLSX from "xlsx";
import { prisma } from "./index";

function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s === "None" ? null : s;
}

export async function seedBrteList(filePath: string) {
  const wb = XLSX.readFile(filePath);
  // Take into account only the first sheet as requested
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  if (!ws) throw new Error(`No sheet found in ${filePath}`);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });
  console.log(`  Found ${rows.length} rows in sheet "${firstSheetName}" of ${path.basename(filePath)}`);

  type BrteData = {
    emis: string;
    name: string;
    block: string | null;
  };

  const brteMap = new Map<string, BrteData>();

  for (const row of rows) {
    const rawEmis = clean(row["BRTE-EMIS-ID"] ?? row["BRTE_EMIS_ID"] ?? row["EMIS_ID"] ?? row["EMIS"]);
    const rawName = clean(row["BRTE-NAME in EMIS"] ?? row["BRTE_NAME"] ?? row["NAME"] ?? row["Name"]);
    const rawBlock = clean(row["BLOCK"] ?? row["Block"]);

    if (!rawEmis || !rawName) continue;

    // EMIS ID should be 8 digits (zero-padded if numeric)
    const cleanedEmis = String(rawEmis).replace(/\D/g, "").padStart(8, "0");
    if (cleanedEmis.length !== 8) continue;

    brteMap.set(cleanedEmis, {
      emis: cleanedEmis,
      name: rawName,
      block: rawBlock,
    });
  }

  const brteList = [...brteMap.values()];
  console.log(`🌱 Upserting ${brteList.length} unique BRTEs into the database...`);

  let insertedCount = 0;
  for (const brte of brteList) {
    await prisma.brte.upsert({
      where: { emis: brte.emis },
      update: {
        name: brte.name,
        block: brte.block,
        isActive: true,
      },
      create: {
        emis: brte.emis,
        name: brte.name,
        block: brte.block,
        isActive: true,
      },
    });
    insertedCount++;
  }

  console.log(`✅ ${insertedCount} BRTEs processed successfully!`);
}

async function main() {
  const root = path.resolve(process.cwd());
  const filePath = path.join(root, "BRTE LIST NEW.xlsx");

  console.log("\n🚀 Starting BRTE Seed process using first sheet of BRTE LIST NEW.xlsx...");
  await seedBrteList(filePath);

  console.log("\n✅ BRTE Seed complete!");
  await prisma.$disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch(async (err) => {
    console.error("❌ BRTE Seed failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
}
