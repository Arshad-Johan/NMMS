"use server";

import { prisma } from "@/db/index";
import { signToken, verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/cookies";
import { checkAndSetDeviceLock } from "@/lib/device";

// ---------------------------------------------------------------------------
// Login Action (Direct login without OTP, but locked to device)
// ---------------------------------------------------------------------------
export async function loginWithMobileAction(
  mobile: string
): Promise<{ success?: true; error?: string }> {
  const cleaned = mobile.replace(/\D/g, "").slice(-10);
  if (cleaned.length !== 10) {
    return { error: "Enter a valid 10-digit mobile number." };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { mobile: cleaned },
    select: { id: true, name: true, mobile: true, isActive: true },
  });

  if (!teacher || !teacher.isActive) {
    return { error: "Number not registered in NMMS. Contact your administrator." };
  }

  // Check device lock
  const deviceCheck = await checkAndSetDeviceLock(cleaned);
  if (!deviceCheck.allowed) {
    return { error: deviceCheck.error };
  }

  const roleToAssign = "teacher";

  const token = signToken({
    id: teacher.id,
    mobile: teacher.mobile,
    name: teacher.name,
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
