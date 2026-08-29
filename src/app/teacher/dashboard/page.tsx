import { redirect } from "next/navigation";
import { getSession } from "@/lib/cookies";
import { prisma } from "@/db/index";
import TeacherDashboardClient from "@/components/teacher/teacher-dashboard-client";

export default async function TeacherDashboard() {
  const session = await getSession();
  if (!session || session.role !== "teacher") redirect("/login");

  const teacher = await prisma.teacher.findUnique({
    where: { id: session.id },
    include: {
      school: {
        select: {
          name: true,
          udise: true,
          block: true,
          educationDistrict: true,
          categoryType: true,
          management: true,
        },
      },
    },
  });

  if (!teacher) redirect("/login");

  const teacherId = teacher.id;
  const categoryType = teacher.school.categoryType;
  const management = teacher.school.management;
  const block = teacher.school.block;

  // 1. Fetch Stats
  const totalAttendance = await prisma.attendance.count({
    where: { teacherId },
  });
  const presentCount = await prisma.attendance.count({
    where: { teacherId, status: "present" },
  });
  const absentCount = await prisma.attendance.count({
    where: { teacherId, status: "absent" },
  });
  const attendanceRate =
    totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : null;

  // 2. Fetch Scheduled Sessions assigned to this teacher
  const sessions = await prisma.session.findMany({
    where: {
      isPublished: true,
      AND: [
        {
          OR: [
            { categoryRules: { none: {} } },
            ...(categoryType ? [{ categoryRules: { some: { categoryType } } }] : []),
          ],
        },
        {
          OR: [
            { managementRules: { none: {} } },
            ...(management ? [{ managementRules: { some: { management } } }] : []),
          ],
        },
        {
          OR: [
            { blockRules: { none: {} } },
            ...(block ? [{ blockRules: { some: { block } } }] : []),
          ],
        },
      ],
    },
    include: {
      attendance: {
        where: { teacherId },
        select: { status: true, markedAt: true },
      },
    },
    orderBy: { sessionDate: "desc" },
  });

  const formattedAssignedSessions = sessions.map((s) => {
    const userAttendance = s.attendance[0] ?? null;
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      sessionDate: s.sessionDate.toISOString(),
      startTime: s.startTime ? s.startTime.toISOString() : null,
      endTime: s.endTime ? s.endTime.toISOString() : null,
      generalMeetUrl: s.generalMeetUrl,
      isAttendanceOpen: s.isAttendanceOpen,
      userAttendance,
    };
  });

  // 3. Fetch Recent Attendance History
  const recentAttendance = await prisma.attendance.findMany({
    where: { teacherId },
    include: { session: { select: { title: true, sessionDate: true } } },
    orderBy: { markedAt: "desc" },
    take: 5,
  });

  const formattedRecentAttendance = recentAttendance.map((a) => ({
    id: a.id,
    status: a.status,
    markedAt: a.markedAt ? a.markedAt.toISOString() : null,
    session: {
      title: a.session.title,
      sessionDate: a.session.sessionDate.toISOString(),
    },
  }));

  return (
    <TeacherDashboardClient
      teacher={teacher}
      stats={{
        totalAttendance,
        presentCount,
        absentCount,
        attendanceRate,
      }}
      assignedSessions={formattedAssignedSessions}
      recentAttendance={formattedRecentAttendance}
    />
  );
}
