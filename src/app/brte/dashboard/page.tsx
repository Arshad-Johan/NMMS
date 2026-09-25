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
  const brteSessionsPromise = prisma.brteSession.findMany({
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

  // Fetch NMMS sessions where BRTEs are included
  const nmmsSessionsPromise = prisma.session.findMany({
    where: {
      sessionType: "NMMS",
      isPublished: true,
      includeBrte: true,
    },
    include: {
      sessionBrteAttendance: {
        where: { brteId: brte.id },
        select: { status: true, markedAt: true },
      },
    },
    orderBy: { sessionDate: "desc" },
  });

  // Recent attendance history for both BRTE sessions and NMMS sessions
  const recentBrteAttendancePromise = prisma.brteAttendance.findMany({
    where: { brteId: brte.id },
    include: { session: { select: { title: true, sessionDate: true } } },
    orderBy: { markedAt: "desc" },
    take: 10,
  });

  const recentNmmsAttendancePromise = prisma.sessionBrteAttendance.findMany({
    where: { brteId: brte.id },
    include: { session: { select: { title: true, sessionDate: true } } },
    orderBy: { markedAt: "desc" },
    take: 10,
  });

  const [brteSessions, nmmsSessions, recentBrteAttendance, recentNmmsAttendance] =
    await Promise.all([
      brteSessionsPromise,
      nmmsSessionsPromise,
      recentBrteAttendancePromise,
      recentNmmsAttendancePromise,
    ]);

  const formattedBrteSessions = brteSessions.map((s) => ({
    id: s.id,
    sessionType: "BRTE",
    title: s.title,
    description: s.description,
    sessionDate: s.sessionDate.toISOString(),
    startTime: s.startTime ? s.startTime.toISOString() : null,
    endTime: s.endTime ? s.endTime.toISOString() : null,
    generalMeetUrl: s.generalMeetUrl,
    isAttendanceOpen: s.isAttendanceOpen,
    userAttendance: s.attendance[0] ?? null,
  }));

  const formattedNmmsSessions = nmmsSessions.map((s) => ({
    id: s.id,
    sessionType: "NMMS",
    title: s.title,
    description: s.description,
    sessionDate: s.sessionDate.toISOString(),
    startTime: s.startTime ? s.startTime.toISOString() : null,
    endTime: s.endTime ? s.endTime.toISOString() : null,
    generalMeetUrl: s.generalMeetUrl,
    isAttendanceOpen: s.isAttendanceOpen,
    userAttendance: s.sessionBrteAttendance[0] ?? null,
  }));

  // Merge and sort all assigned sessions descending by sessionDate
  const allFormattedSessions = [...formattedNmmsSessions, ...formattedBrteSessions].sort(
    (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
  );

  const formattedRecentAttendance = [
    ...recentBrteAttendance.map((a) => ({
      id: a.id,
      status: a.status,
      markedAt: a.markedAt ? a.markedAt.toISOString() : null,
      session: {
        title: a.session.title,
        sessionDate: a.session.sessionDate.toISOString(),
        sessionType: "BRTE",
      },
    })),
    ...recentNmmsAttendance.map((a) => ({
      id: a.id,
      status: a.status,
      markedAt: a.markedAt ? a.markedAt.toISOString() : null,
      session: {
        title: a.session.title,
        sessionDate: a.session.sessionDate.toISOString(),
        sessionType: "NMMS",
      },
    })),
  ]
    .sort((a, b) => {
      const timeA = a.markedAt ? new Date(a.markedAt).getTime() : 0;
      const timeB = b.markedAt ? new Date(b.markedAt).getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 10);

  return (
    <BrteDashboardClient
      brte={brte}
      assignedSessions={allFormattedSessions}
      recentAttendance={formattedRecentAttendance}
    />
  );
}
