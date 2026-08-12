"use server";

import { prisma } from "@/db/index";
import { getSession } from "@/lib/cookies";

export async function markMyAttendanceAction(sessionId: string): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "teacher") return { error: "Unauthorized." };

  try {
    const trainingSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!trainingSession || !trainingSession.isPublished) {
      return { error: "Session is not active." };
    }

    await prisma.attendance.upsert({
      where: {
        sessionId_teacherId: { sessionId, teacherId: session.id },
      },
      create: {
        sessionId,
        teacherId: session.id,
        status: "present",
        markedAt: new Date(),
      },
      update: {
        status: "present",
        markedAt: new Date(),
      },
    });

    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to mark attendance." };
  }
}
