"use server";

import { prisma } from "@/db/index";
import { getSession } from "@/lib/cookies";

export async function markMyBrteAttendanceAction(sessionId: string): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "brte") return { error: "Unauthorized." };

  try {
    const brteSession = await prisma.brteSession.findUnique({
      where: { id: sessionId },
    });

    if (brteSession) {
      if (!brteSession.isPublished) {
        return { error: "Session is not active." };
      }

      await prisma.brteAttendance.upsert({
        where: {
          sessionId_brteId: { sessionId, brteId: session.id },
        },
        create: {
          sessionId,
          brteId: session.id,
          status: "present",
          markedAt: new Date(),
        },
        update: {
          status: "present",
          markedAt: new Date(),
        },
      });

      return { success: true };
    }

    // Check if it is an NMMS session that includes BRTEs
    const nmmsSession = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (nmmsSession && nmmsSession.includeBrte) {
      if (!nmmsSession.isPublished) {
        return { error: "Session is not active." };
      }

      await prisma.sessionBrteAttendance.upsert({
        where: {
          sessionId_brteId: { sessionId, brteId: session.id },
        },
        create: {
          sessionId,
          brteId: session.id,
          status: "present",
          markedAt: new Date(),
        },
        update: {
          status: "present",
          markedAt: new Date(),
        },
      });

      return { success: true };
    }

    return { error: "Session is not active or not accessible for BRTE." };
  } catch (err: any) {
    return { error: err.message ?? "Failed to mark attendance." };
  }
}
