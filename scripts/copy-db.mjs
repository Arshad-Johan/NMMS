/**
 * copy-db.mjs
 * -----------
 * Copies all data from SOURCE_DATABASE_URL → TARGET_DATABASE_URL.
 * Uses @prisma/adapter-neon + ws, matching how this project connects to Neon.
 *
 * Usage (PowerShell — set vars first, then run):
 *   $env:SOURCE_DATABASE_URL="postgresql://..."
 *   $env:TARGET_DATABASE_URL="postgresql://..."
 *   node scripts/copy-db.mjs
 */

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Required for Node.js environments (not a browser)
neonConfig.webSocketConstructor = ws;

const SOURCE_URL = process.env.SOURCE_DATABASE_URL;
const TARGET_URL = process.env.TARGET_DATABASE_URL;

if (!SOURCE_URL || !TARGET_URL) {
  console.error("\n❌  Please set SOURCE_DATABASE_URL and TARGET_DATABASE_URL.\n");
  process.exit(1);
}

function makeClient(url) {
  const adapter = new PrismaNeon({ connectionString: url });
  return new PrismaClient({ adapter });
}

const BATCH = 500;

async function insert(tgt, name, rows, inserter) {
  if (rows.length === 0) {
    console.log(`  ${name}: 0 rows — skipped`);
    return;
  }
  let n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    await inserter(rows.slice(i, i + BATCH));
    n += Math.min(BATCH, rows.length - i);
  }
  console.log(`  ${name}: ✓  ${n} rows`);
}

// ── Step 1: dump everything from source ─────────────────────────────────────

console.log("\n📥  Reading from SOURCE…\n");
const src = makeClient(SOURCE_URL);

const data = {
  users:                  await src.user.findMany(),
  schools:                await src.school.findMany(),
  brtes:                  await src.brte.findMany(),
  teachers:               await src.teacher.findMany(),
  headOfSchools:          await src.headOfSchool.findMany(),
  sessions:               await src.session.findMany(),
  brteSessions:           await src.brteSession.findMany(),
  sessionCategoryRules:   await src.sessionCategoryRule.findMany(),
  sessionSchoolTypeRules: await src.sessionSchoolTypeRule.findMany(),
  sessionBlockRules:      await src.sessionBlockRule.findMany(),
  brteSessionBlockRules:  await src.brteSessionBlockRule.findMany(),
  attendance:             await src.attendance.findMany(),
  meetLinks:              await src.meetLink.findMany(),
  brteAttendance:         await src.brteAttendance.findMany(),
};

for (const [k, v] of Object.entries(data)) {
  console.log(`  ${k}: ${v.length} rows read`);
}
await src.$disconnect();

// ── Step 2: write to target in FK-safe order ─────────────────────────────────

console.log("\n📤  Writing to TARGET…\n");
const tgt = makeClient(TARGET_URL);

await insert(tgt, "users",                   data.users,                  r => tgt.user.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "schools",                 data.schools,                r => tgt.school.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "brtes",                   data.brtes,                  r => tgt.brte.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "teachers",               data.teachers,               r => tgt.teacher.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "head_of_schools",         data.headOfSchools,          r => tgt.headOfSchool.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "sessions",               data.sessions,               r => tgt.session.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "brte_sessions",           data.brteSessions,           r => tgt.brteSession.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "session_category_rules",  data.sessionCategoryRules,   r => tgt.sessionCategoryRule.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "session_schooltype_rules",data.sessionSchoolTypeRules, r => tgt.sessionSchoolTypeRule.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "session_block_rules",     data.sessionBlockRules,      r => tgt.sessionBlockRule.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "brte_session_block_rules",data.brteSessionBlockRules,  r => tgt.brteSessionBlockRule.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "attendance",              data.attendance,             r => tgt.attendance.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "meet_links",              data.meetLinks,              r => tgt.meetLink.createMany({ data: r, skipDuplicates: true }));
await insert(tgt, "brte_attendance",         data.brteAttendance,         r => tgt.brteAttendance.createMany({ data: r, skipDuplicates: true }));

await tgt.$disconnect();

console.log("\n✅  Database copy complete!\n");
