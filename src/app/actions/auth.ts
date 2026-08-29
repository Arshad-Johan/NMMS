"use server";

import { prisma } from "@/db/index";
import { signToken, verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/cookies";
import { checkAndSetDeviceLock } from "@/lib/device";

// ---------------------------------------------------------------------------
// Login Action (UDISE Code Login, locked to device per day)
// ---------------------------------------------------------------------------
export async function loginWithUdiseAction(
  udise: string
): Promise<{ success?: true; error?: string }> {
  const cleaned = udise.trim().replace(/\D/g, "");
  if (!cleaned || cleaned.length < 8 || cleaned.length > 11) {
    return { error: "Please enter a valid 11-digit UDISE code." };
  }

  // Find school first
  const school = await prisma.school.findUnique({
    where: { udise: cleaned },
    include: { teachers: { where: { isActive: true }, take: 1 } },
  });

  if (!school || !school.isActive) {
    return { error: "UDISE code not found or school is inactive. Contact your administrator." };
  }

  let teacher = school.teachers[0];

  if (!teacher) {
    // Check if any teacher (active or inactive) exists for this UDISE code
    const anyTeacher = await prisma.teacher.findFirst({
      where: { schoolUdise: cleaned },
    });

    if (anyTeacher) {
      teacher = anyTeacher;
    } else {
      // Auto-create a primary teacher entry for this school
      teacher = await prisma.teacher.create({
        data: {
          schoolUdise: cleaned,
          name: school.name,
          mobile: cleaned,
          isActive: true,
        },
      });
    }
  }

  if (!teacher.isActive) {
    return { error: "Teacher account for this UDISE code is inactive. Contact your administrator." };
  }

  // Check device lock using cleaned UDISE code
  const deviceCheck = await checkAndSetDeviceLock(cleaned);
  if (!deviceCheck.allowed) {
    return { error: deviceCheck.error };
  }

  const roleToAssign = "teacher";

  const token = signToken({
    id: teacher.id,
    mobile: teacher.mobile,
    name: teacher.name ?? school.name,
    role: roleToAssign,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  });

  await setSessionCookie(token);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Admin Password Login Action
// ---------------------------------------------------------------------------
export async function adminPasswordLoginAction(
  email: string,
  pass: string
): Promise<{ success?: true; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: cleanEmail },
  });

  if (!user || user.role !== "admin") {
    return { error: "Invalid admin credentials." };
  }

  const valid = verifyPassword(pass, user.passwordHash);
  if (!valid) {
    return { error: "Invalid admin credentials." };
  }

  const token = signToken({
    id: user.id,
    mobile: "0000000000",
    name: user.name,
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  });

  await setSessionCookie(token);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
}
