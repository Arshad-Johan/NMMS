"use server";

import { prisma } from "@/db/index";
import { signToken, verifyPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/cookies";
import { sendSmsOtp } from "@/lib/sms";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ---------------------------------------------------------------------------
// Send OTP
// ---------------------------------------------------------------------------
export async function sendOtpAction(
  mobile: string
): Promise<{ success?: true; error?: string }> {
  const cleaned = mobile.replace(/\D/g, "").slice(-10);
  if (cleaned.length !== 10) {
    return { error: "Enter a valid 10-digit mobile number." };
  }

  const teacher = await prisma.teacher.findUnique({
    where: { mobile: cleaned },
    select: { id: true, isActive: true },
  });

  if (!teacher || !teacher.isActive) {
    return { error: "Number not registered. Contact your administrator." };
  }

  // Expire any existing pending OTPs for this mobile
  await prisma.otpVerification.updateMany({
    where: { mobile: cleaned, status: "pending" },
    data: { status: "expired" },
  });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  await prisma.otpVerification.create({
    data: { mobile: cleaned, otp, expiresAt },
  });

  // Always log OTP in server console for instant developer verification
  console.log(`\n[OTP GENERATED] Mobile: ${cleaned} | Code: ${otp} (valid 10 min)\n`);

  // Dispatch SMS OTP via configured SMS Gateway
  const smsRes = await sendSmsOtp(cleaned, otp);
  if (!smsRes.success) {
    console.warn(`[SMS Gateway Notice] Mobile: ${cleaned} | Error: ${smsRes.error}`);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Verify OTP (Supports Role Parameter)
// ---------------------------------------------------------------------------
export async function verifyOtpAction(
  mobile: string,
  otp: string,
  targetRole: "teacher" | "admin" = "teacher"
): Promise<{ success?: true; error?: string; role?: "teacher" | "admin" }> {
  const cleaned = mobile.replace(/\D/g, "").slice(-10);

  const record = await prisma.otpVerification.findFirst({
    where: {
      mobile: cleaned,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { error: "OTP expired or not found. Request a new one." };
  }

  if (record.attempts >= 3) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { status: "expired" },
    });
    return { error: "Too many wrong attempts. Request a new OTP." };
  }

  if (record.otp !== otp) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = 2 - record.attempts;
    return { error: `Wrong OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} left.` };
  }

  // Mark verified
  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { status: "verified" },
  });

  // Fetch teacher details
  const teacher = await prisma.teacher.findUnique({
    where: { mobile: cleaned },
    select: { id: true, name: true, mobile: true },
  });

  if (!teacher) return { error: "Teacher record not found." };

  const roleToAssign = targetRole === "admin" ? "admin" : "teacher";

  const token = signToken({
    id: teacher.id,
    mobile: teacher.mobile,
    name: teacher.name,
    role: roleToAssign,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  });

  await setSessionCookie(token);
  return { success: true, role: roleToAssign };
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
