import { redirect } from "next/navigation";
import { getSession } from "@/lib/cookies";
import { prisma } from "@/db/index";
import BrteDashboardClient from "@/components/brte/brte-dashboard-client";

export default async function BrteDashboard() {
  const session = await getSession();
  if (!session || session.role !== "brte") redirect("/login");

  const brte = await prisma.brte.findUnique({
    where: { id: session.id },
  });

  if (!brte) redirect("/login");

  const block = brte.block;

  // Fetch BRTE sessions assigned to this BRTE's block (or all-BRTE sessions)
  const brteSessions = await prisma.brteSession.findMany({
    where: {
      isPublished: true,
      AND: [
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
        where: { brteId: brte.id },
        select: { status: true, markedAt: true },
      },
    },
    orderBy: { sessionDate: "desc" },
  });

  const formattedSessions = brteSessions.map((s) => {
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

  // Recent attendance history
  const recentAttendance = await prisma.brteAttendance.findMany({
    where: { brteId: brte.id },
    include: { session: { select: { title: true, sessionDate: true } } },
    orderBy: { markedAt: "desc" },
    take: 10,
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
    <BrteDashboardClient
      brte={brte}
      assignedSessions={formattedSessions}
      recentAttendance={formattedRecentAttendance}
    />
  );
}
