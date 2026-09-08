"use server";

import { prisma } from "@/db/index";
import { signToken, verifyPassword, hashPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/cookies";
import { checkAndSetDeviceLock, checkAndSetBrteDeviceLock } from "@/lib/device";

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
// Admin Password Login Action (Single Password: prince@1977)
// ---------------------------------------------------------------------------
export async function adminPasswordLoginAction(
  pass: string
): Promise<{ success?: true; error?: string }> {
  const trimmedPass = pass.trim();
  if (!trimmedPass) {
    return { error: "Please enter the admin password." };
  }

  // Find or create default admin user
  let user = await prisma.user.findFirst({
    where: { role: "admin" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Administrator",
        email: "admin@nmms.local",
        passwordHash: hashPassword("prince@1977"),
        role: "admin",
      },
    });
  }

  const isMasterMatch = trimmedPass === "prince@1977";
  const isHashMatch = verifyPassword(trimmedPass, user.passwordHash);

  if (!isMasterMatch && !isHashMatch) {
    return { error: "Invalid admin password." };
  }

  // If master password matched, ensure DB password hash is up to date
  if (isMasterMatch && !isHashMatch) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword("prince@1977") },
    });
  }

  const token = signToken({
    id: user.id,
    mobile: "0000000000",
    name: user.name ?? "Administrator",
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

// ---------------------------------------------------------------------------
// BRTE Login Action (EMIS ID Login, locked to device per day)
// ---------------------------------------------------------------------------
export async function loginWithBrteAction(
  emisId: string
): Promise<{ success?: true; error?: string }> {
  const cleaned = emisId.trim().replace(/\D/g, "");
  if (!cleaned || cleaned.length !== 8) {
    return { error: "Please enter a valid 8-digit BRTE EMIS ID." };
  }

  // Find BRTE record
  const brte = await prisma.brte.findUnique({
    where: { emis: cleaned },
  });

  if (!brte || !brte.isActive) {
    return { error: "BRTE EMIS ID not found or account is inactive. Contact your administrator." };
  }

  // Check device lock using cleaned EMIS ID
  const deviceCheck = await checkAndSetBrteDeviceLock(cleaned);
  if (!deviceCheck.allowed) {
    return { error: deviceCheck.error };
  }

  const token = signToken({
    id: brte.id,
    mobile: brte.emis,
    name: brte.name,
    role: "brte",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  });

  await setSessionCookie(token);
  return { success: true };
}
