"use server";

import { prisma } from "@/db/index";
import { signToken, verifyPassword, hashPassword } from "@/lib/auth";
import { setSessionCookie, clearSessionCookie } from "@/lib/cookies";
import { checkAndSetDeviceLock, checkAndSetBrteDeviceLock } from "@/lib/device";

// ---------------------------------------------------------------------------
// Login Action (UDISE Code Login, locked to device per day)
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Login Action (UDISE Code Login, locked to device per day)
// ---------------------------------------------------------------------------
export type LoginUdiseResult = {
  success?: true;
  error?: string;
  needsHosSetup?: boolean;
  school?: {
    udise: string;
    name: string;
    block?: string | null;
    educationDistrict?: string | null;
  };
};

export async function loginWithUdiseAction(
  udise: string
): Promise<LoginUdiseResult> {
  const cleaned = udise.trim().replace(/\D/g, "");
  if (!cleaned || cleaned.length < 8 || cleaned.length > 11) {
    return { error: "Please enter a valid 11-digit UDISE code." };
  }

  // Find school first
  const school = await prisma.school.findUnique({
    where: { udise: cleaned },
    include: {
      teachers: { where: { isActive: true }, take: 1 },
      headOfSchool: true,
    },
  });

  if (!school || !school.isActive) {
    return { error: "UDISE code not found or school is inactive. Contact your administrator." };
  }

  // Check device lock using cleaned UDISE code
  const deviceCheck = await checkAndSetDeviceLock(cleaned);
  if (!deviceCheck.allowed) {
    return { error: deviceCheck.error };
  }

  // Check if HM / Incharge details have been provided
  const hos = school.headOfSchool;
  const isHosCompleted = Boolean(hos?.name?.trim() && hos?.mobile?.trim());

  if (!isHosCompleted) {
    return {
      needsHosSetup: true,
      school: {
        udise: school.udise,
        name: school.name,
        block: school.block,
        educationDistrict: school.educationDistrict,
      },
    };
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
          name: hos?.name ?? school.name,
          mobile: `UD_${cleaned}`,
          isActive: true,
        },
      });
    }
  }

  if (!teacher.isActive) {
    return { error: "Teacher account for this UDISE code is inactive. Contact your administrator." };
  }

  const roleToAssign = "teacher";

  const token = signToken({
    id: teacher.id,
    mobile: hos?.mobile ?? teacher.mobile,
    name: hos?.name ?? teacher.name ?? school.name,
    role: roleToAssign,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  });

  await setSessionCookie(token);
  return { success: true };
}

// ---------------------------------------------------------------------------
// HM / Incharge One-Time Registration & Login Action
// ---------------------------------------------------------------------------
export async function completeHosRegistrationAction(data: {
  udise: string;
  name: string;
  confirmName: string;
  mobile: string;
  confirmMobile: string;
  hosType?: string;
}): Promise<{ success?: true; error?: string }> {
  const cleanedUdise = (data.udise ?? "").trim().replace(/\D/g, "");
  if (!cleanedUdise || cleanedUdise.length < 8 || cleanedUdise.length > 11) {
    return { error: "Invalid school UDISE code." };
  }

  const name = (data.name ?? "").trim();
  const confirmName = (data.confirmName ?? "").trim();
  if (!name || name.length < 2) {
    return { error: "Please enter the HM / Incharge name." };
  }
  if (!confirmName) {
    return { error: "Please reconfirm the HM / Incharge name by retyping it." };
  }
  if (name.toLowerCase() !== confirmName.toLowerCase()) {
    return { error: "HM / Incharge name and confirmation name do not match. Please retype the name accurately to reconfirm." };
  }

  const mobile = (data.mobile ?? "").trim().replace(/\D/g, "");
  const confirmMobile = (data.confirmMobile ?? "").trim().replace(/\D/g, "");
  if (!mobile || mobile.length !== 10) {
    return { error: "Please enter a valid 10-digit mobile phone number." };
  }
  if (!confirmMobile) {
    return { error: "Please reconfirm the mobile phone number by retyping it." };
  }
  if (mobile !== confirmMobile) {
    return { error: "Phone number and confirmation phone number do not match. Please retype the phone number accurately to reconfirm." };
  }

  const school = await prisma.school.findUnique({
    where: { udise: cleanedUdise },
    include: {
      teachers: { where: { isActive: true }, take: 1 },
      headOfSchool: true,
    },
  });

  if (!school || !school.isActive) {
    return { error: "School not found or inactive. Contact your administrator." };
  }

  // Device lock check
  const deviceCheck = await checkAndSetDeviceLock(cleanedUdise);
  if (!deviceCheck.allowed) {
    return { error: deviceCheck.error };
  }

  const validHosTypes = [
    "Head_Master_Principal",
    "Asst_Head_Master_Vice_Principal",
    "Acting_Head_Teacher",
    "Incharge_from_other_school",
    "Incharge_from_Block_District",
    "Others",
  ];
  const assignedHosType = data.hosType && validHosTypes.includes(data.hosType)
    ? (data.hosType as any)
    : "Head_Master_Principal";

  // Upsert HeadOfSchool record
  const hos = await prisma.headOfSchool.upsert({
    where: { schoolUdise: cleanedUdise },
    create: {
      schoolUdise: cleanedUdise,
      name,
      mobile,
      hosType: assignedHosType,
    },
    update: {
      name,
      mobile,
      hosType: assignedHosType,
      updatedAt: new Date(),
    },
  });

  // Ensure teacher record exists and update teacher name to HM name
  let teacher = school.teachers[0];
  if (!teacher) {
    const anyTeacher = await prisma.teacher.findFirst({
      where: { schoolUdise: cleanedUdise },
    });
    if (anyTeacher) {
      teacher = anyTeacher;
      await prisma.teacher.update({
        where: { id: teacher.id },
        data: { name },
      });
    } else {
      teacher = await prisma.teacher.create({
        data: {
          schoolUdise: cleanedUdise,
          name,
          mobile: `UD_${cleanedUdise}`,
          isActive: true,
        },
      });
    }
  } else {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { name },
    });
  }

  if (!teacher.isActive) {
    return { error: "Teacher account for this UDISE code is inactive. Contact your administrator." };
  }

  // Generate session token and cookie
  const token = signToken({
    id: teacher.id,
    mobile: hos.mobile ?? mobile,
    name: hos.name ?? name,
    role: "teacher",
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
  });

  await setSessionCookie(token);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Admin Password Login Action (Single Password: ceomadurai@1977)
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
        passwordHash: hashPassword("ceomadurai@1977"),
        role: "admin",
      },
    });
  }

  const isMasterMatch = trimmedPass === "ceomadurai@1977";
  const isHashMatch = verifyPassword(trimmedPass, user.passwordHash);

  if (!isMasterMatch && !isHashMatch) {
    return { error: "Invalid admin password." };
  }

  // If master password matched, ensure DB password hash is up to date
  if (isMasterMatch && !isHashMatch) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword("ceomadurai@1977") },
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
