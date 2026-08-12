import { redirect, notFound } from "next/navigation";
import { prisma } from "@/db/index";

interface MeetRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function MeetRedirectPage({ params }: MeetRedirectProps) {
  const { slug } = await params;

  if (!slug) notFound();

  const meetLink = await prisma.meetLink.findUnique({
    where: { slug },
    include: {
      session: true,
      teacher: true,
    },
  });

  if (!meetLink || !meetLink.session.isPublished) {
    notFound();
  }

  // 1. Increment click count and update last clicked time
  await prisma.meetLink.update({
    where: { id: meetLink.id },
    data: {
      clickCount: { increment: 1 },
      lastClickedAt: new Date(),
    },
  });

  // 2. Auto-mark teacher attendance as Present
  try {
    await prisma.attendance.upsert({
      where: {
        sessionId_teacherId: {
          sessionId: meetLink.sessionId,
          teacherId: meetLink.teacherId,
        },
      },
      create: {
        sessionId: meetLink.sessionId,
        teacherId: meetLink.teacherId,
        status: "present",
        markedAt: new Date(),
        remarks: "Auto-marked via personalized Meet link slug",
      },
      update: {
        status: "present",
        markedAt: new Date(),
        remarks: "Updated via personalized Meet link slug",
      },
    });
  } catch (err) {
    console.error("Failed to auto-mark attendance on slug click:", err);
  }

  // 3. Instant redirect to the master Google Meet URL
  redirect(meetLink.session.generalMeetUrl);
}
