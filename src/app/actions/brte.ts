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

    if (!brteSession || !brteSession.isPublished) {
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
  } catch (err: any) {
    return { error: err.message ?? "Failed to mark attendance." };
  }
}
