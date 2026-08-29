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
    totalAttendance,
    presentAttendance,
    sessions,
    schools,
    recentAttendance,
    rawManagements,
    rawBlocks,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.session.count(),
    prisma.attendance.count(),
    prisma.attendance.count({ where: { status: "present" } }),
    prisma.session.findMany({
      include: {
        categoryRules: true,
        managementRules: true,
        blockRules: true,
        _count: { select: { attendance: true, meetLinks: true } },
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
      where: { management: { not: null } },
      select: { management: true },
      distinct: ["management"],
      orderBy: { management: "asc" },
    }),
    prisma.school.findMany({
      where: { block: { not: null } },
      select: { block: true },
      distinct: ["block"],
      orderBy: { block: "asc" },
    }),
  ]);

  const availableManagements = rawManagements
    .map((m) => m.management)
    .filter((m): m is string => Boolean(m));

  const availableBlocks = rawBlocks
    .map((b) => b.block)
    .filter((b): b is string => Boolean(b));

  const overallRate =
    totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;

  const adminName = session.name ?? "System Admin";

  return (
    <AdminDashboardClient
      adminName={adminName}
      availableManagements={availableManagements}
      availableBlocks={availableBlocks}
      stats={{
        totalSchools,
        totalSessions,
        overallRate,
      }}
      initialSessions={sessions.map((s) => ({
        ...s,
        sessionDate: s.sessionDate.toISOString(),
        startTime: s.startTime ? s.startTime.toISOString() : null,
        endTime: s.endTime ? s.endTime.toISOString() : null,
        createdAt: s.createdAt.toISOString(),
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
