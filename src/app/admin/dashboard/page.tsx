import { redirect } from "next/navigation";
import { getSession } from "@/lib/cookies";
import { prisma } from "@/db/index";
import AdminDashboardClient from "@/components/admin/admin-dashboard-client";

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  // Fetch initial stats & full data for the Admin Dashboard (All schools & teachers)
  const [
    totalSchools,
    totalTeachers,
    totalSessions,
    totalAttendance,
    presentAttendance,
    sessions,
    teachers,
    schools,
    recentAttendance,
  ] = await Promise.all([
    prisma.school.count(),
    prisma.teacher.count(),
    prisma.session.count(),
    prisma.attendance.count(),
    prisma.attendance.count({ where: { status: "present" } }),
    prisma.session.findMany({
      include: {
        categoryRules: true,
        _count: { select: { attendance: true, meetLinks: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.teacher.findMany({
      include: {
        school: {
          select: {
            name: true,
            block: true,
            educationDistrict: true,
            categoryType: true,
          },
        },
      },
      orderBy: { name: "asc" },
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
  ]);

  const overallRate =
    totalAttendance > 0 ? Math.round((presentAttendance / totalAttendance) * 100) : 0;

  const adminName = session.name ?? "System Admin";

  return (
    <AdminDashboardClient
      adminName={adminName}
      stats={{
        totalSchools,
        totalTeachers,
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
      initialTeachers={teachers.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
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
