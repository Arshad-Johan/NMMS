import { redirect } from "next/navigation";
import { getSession } from "@/lib/cookies";
import { prisma } from "@/db/index";
import AdminDashboardClient from "@/components/admin/admin-dashboard-client";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  // Fetch initial stats & full data for the Admin Dashboard
  const [
    totalSchools,
    totalSessions,
    totalHmSessions,
    totalNmmsSessions,
    totalBrteSessions,
    totalAttendance,
    presentAttendance,
    sessions,
    brteSessions,
    schools,
    recentAttendance,
    rawSchoolTypes,
    rawBlocks,
    rawBrteBlocks,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.session.count(),
    prisma.session.count({ where: { sessionType: "HM" } }),
    prisma.session.count({ where: { sessionType: "NMMS" } }),
    prisma.brteSession.count(),
    prisma.attendance.count(),
    prisma.attendance.count({ where: { status: "present" } }),
    prisma.session.findMany({
      include: {
        categoryRules: true,
        schoolTypeRules: true,
        blockRules: true,
        _count: { select: { attendance: true, meetLinks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.brteSession.findMany({
      include: {
        blockRules: true,
        _count: { select: { attendance: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.school.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      include: {
        teacher: { select: { name: true, mobile: true, schoolUdise: true } },
        session: { select: { title: true, sessionDate: true } },
      },
      orderBy: { markedAt: "desc" },
      take: 100,
    }),
    prisma.school.findMany({
      where: { schoolType: { not: null } },
      select: { schoolType: true },
      distinct: ["schoolType"],
      orderBy: { schoolType: "asc" },
    }),
    prisma.school.findMany({
      where: { block: { not: null } },
      select: { block: true },
      distinct: ["block"],
      orderBy: { block: "asc" },
    }),
    prisma.brte.findMany({
      where: { block: { not: null } },
      select: { block: true },
      distinct: ["block"],
      orderBy: { block: "asc" },
    }),
  ]);

  const availableSchoolTypes = rawSchoolTypes
    .map((s) => s.schoolType)
    .filter((s): s is string => Boolean(s));

  const availableBlocks = rawBlocks
    .map((b) => b.block)
    .filter((b): b is string => Boolean(b));

  const availableBrteBlocks = rawBrteBlocks
    .map((b) => b.block)
    .filter((b): b is string => Boolean(b));

  const overallRate =
    totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;

  const adminName = session.name ?? "System Admin";

  return (
    <AdminDashboardClient
      adminName={adminName}
      availableSchoolTypes={availableSchoolTypes}
      availableBlocks={availableBlocks}
      availableBrteBlocks={availableBrteBlocks}
      stats={{
        totalSchools,
        totalSessions,
        totalHmSessions,
        totalNmmsSessions,
        totalBrteSessions,
        overallRate,
      }}
      initialSessions={sessions.map((s) => ({
        ...s,
        sessionDate: s.sessionDate.toISOString(),
        startTime: s.startTime ? s.startTime.toISOString() : null,
        endTime: s.endTime ? s.endTime.toISOString() : null,
        createdAt: s.createdAt.toISOString(),
      }))}
      initialBrteSessions={brteSessions.map((bs) => ({
        ...bs,
        sessionDate: bs.sessionDate.toISOString(),
        startTime: bs.startTime ? bs.startTime.toISOString() : null,
        endTime: bs.endTime ? bs.endTime.toISOString() : null,
        createdAt: bs.createdAt.toISOString(),
      }))}
      initialSchools={schools.map((sc) => ({
        ...sc,
        createdAt: sc.createdAt.toISOString(),
      }))}
      initialAttendance={recentAttendance.map((a) => ({
        ...a,
        markedAt: a.markedAt ? a.markedAt.toISOString() : null,
        session: {
          ...a.session,
          sessionDate: a.session.sessionDate.toISOString(),
        },
      }))}
    />
  );
}
