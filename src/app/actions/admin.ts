"use server";

import * as XLSX from "xlsx";
import { prisma } from "@/db/index";
import { getSession } from "@/lib/cookies";
import { CategoryType, SchoolType, AttendanceStatus } from "@prisma/client";

export interface CreateSessionInput {
  title: string;
  description?: string;
  sessionDate: string; // YYYY-MM-DD
  startTime?: string;  // HH:mm (24hr format)
  endTime?: string;    // HH:mm (24hr format)
  generalMeetUrl: string;
  categoryTypes: CategoryType[];
}

// ---------------------------------------------------------------------------
// 1. TEACHER MUTATIONS
// ---------------------------------------------------------------------------

export async function createTeacherAction(data: {
  name: string;
  mobile: string;
  schoolUdise: string;
  subject?: string;
  isActive?: boolean;
}): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  const cleanedMobile = data.mobile.replace(/\D/g, "").slice(-10);
  if (cleanedMobile.length !== 10) return { error: "Enter a valid 10-digit mobile number." };

  const targetUdise = data.schoolUdise.trim();
  if (!targetUdise) return { error: "School UDISE code is required." };

  // Verify school exists in database to prevent FK violation
  const existingSchool = await prisma.school.findUnique({
    where: { udise: targetUdise },
  });

  if (!existingSchool) {
    return {
      error: `School with UDISE code "${targetUdise}" does not exist in Schools Directory. Please select or add the school first under Schools Directory.`,
    };
  }

  try {
    await prisma.teacher.create({
      data: {
        name: data.name,
        mobile: cleanedMobile,
        schoolUdise: targetUdise,
        subject: data.subject ?? null,
        isActive: data.isActive ?? true,
        updatedByAdminId: session.id,
        lastAdminUpdate: new Date(),
      },
    });
    return { success: true };
  } catch (err: any) {
    if (err.code === "P2002") return { error: "A teacher with this mobile number already exists." };
    if (err.code === "P2003") return { error: `School UDISE "${targetUdise}" does not exist in Schools Directory.` };
    return { error: err.message ?? "Failed to create teacher." };
  }
}

export async function updateTeacherAction(
  teacherId: string,
  data: { name?: string; mobile?: string; schoolUdise?: string; subject?: string; isActive?: boolean }
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.mobile) {
      updateData.mobile = data.mobile.replace(/\D/g, "").slice(-10);
    }
    if (data.schoolUdise) {
      const targetUdise = data.schoolUdise.trim();
      const existingSchool = await prisma.school.findUnique({
        where: { udise: targetUdise },
      });
      if (!existingSchool) {
        return { error: `School with UDISE code "${targetUdise}" does not exist.` };
      }
      updateData.schoolUdise = targetUdise;
    }

    updateData.updatedByAdminId = session.id;
    updateData.lastAdminUpdate = new Date();

    await prisma.teacher.update({
      where: { id: teacherId },
      data: updateData,
    });
    return { success: true };
  } catch (err: any) {
    console.error("updateTeacherAction error:", err);
    if (err.code === "P2003") return { error: `School UDISE does not exist.` };
    return { error: err.message ?? "Failed to update teacher." };
  }
}

export async function deleteTeacherAction(teacherId: string): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.teacher.delete({ where: { id: teacherId } });
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to delete teacher." };
  }
}

// ---------------------------------------------------------------------------
// 2. SCHOOL MUTATIONS
// ---------------------------------------------------------------------------

export async function createSchoolAction(data: {
  udise: string;
  name: string;
  educationDistrict?: string;
  block?: string;
  schoolType?: SchoolType;
  categoryType?: CategoryType | null;
  class8Boys?: number;
  class8Girls?: number;
  class8Total?: number;
  willingStudents?: number;
  isActive?: boolean;
}): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  const cleanUdise = data.udise.trim();
  if (!cleanUdise) return { error: "UDISE code is required." };

  try {
    await prisma.school.create({
      data: {
        udise: cleanUdise,
        name: data.name.trim(),
        educationDistrict: data.educationDistrict ?? "Madurai",
        block: data.block ?? null,
        schoolType: data.schoolType ?? "Government",
        categoryType: data.categoryType ?? null,
        class8Boys: data.class8Boys ?? 0,
        class8Girls: data.class8Girls ?? 0,
        class8Total: data.class8Total ?? 0,
        willingStudents: data.willingStudents ?? 0,
        isActive: data.isActive ?? true,
        updatedByAdminId: session.id,
        lastAdminUpdate: new Date(),
      },
    });
    return { success: true };
  } catch (err: any) {
    if (err.code === "P2002") return { error: "A school with this UDISE code already exists." };
    return { error: err.message ?? "Failed to create school." };
  }
}

export async function updateSchoolAction(
  udise: string,
  data: {
    name?: string;
    educationDistrict?: string;
    block?: string;
    schoolType?: SchoolType;
    categoryType?: CategoryType | null;
    class8Boys?: number;
    class8Girls?: number;
    class8Total?: number;
    willingStudents?: number;
    isActive?: boolean;
  }
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const updateData: any = { ...data };
    updateData.updatedByAdminId = session.id;
    updateData.lastAdminUpdate = new Date();

    await prisma.school.update({
      where: { udise },
      data: updateData,
    });
    return { success: true };
  } catch (err: any) {
    console.error("updateSchoolAction error:", err);
    return { error: err.message ?? "Failed to update school." };
  }
}

export async function deleteSchoolAction(udise: string): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.school.delete({ where: { udise } });
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to delete school." };
  }
}

// ---------------------------------------------------------------------------
// 3. SESSION MUTATIONS
// ---------------------------------------------------------------------------

export async function createSessionAction(
  input: CreateSessionInput
): Promise<{ success?: true; createdSession?: any; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const sessionDate = new Date(input.sessionDate);
    const startTime = input.startTime ? new Date(`1970-01-01T${input.startTime}:00.000Z`) : null;
    const endTime = input.endTime ? new Date(`1970-01-01T${input.endTime}:00.000Z`) : null;

    const createdSession = await prisma.session.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        sessionDate,
        startTime,
        endTime,
        generalMeetUrl: input.generalMeetUrl,
        isPublished: true,
        isAttendanceOpen: true,
        createdByAdminId: session.id,
        categoryRules: {
          create: input.categoryTypes.map((categoryType) => ({ categoryType })),
        },
      },
      include: {
        categoryRules: true,
      },
    });

    return {
      success: true,
      createdSession: {
        ...createdSession,
        sessionDate: createdSession.sessionDate.toISOString(),
        startTime: createdSession.startTime ? createdSession.startTime.toISOString() : null,
        endTime: createdSession.endTime ? createdSession.endTime.toISOString() : null,
        createdAt: createdSession.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    console.error("createSessionAction error:", err);
    return { error: err.message ?? "Failed to create session." };
  }
}

export async function updateSessionAction(
  sessionId: string,
  data: { title?: string; generalMeetUrl?: string; isAttendanceOpen?: boolean; isPublished?: boolean }
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.session.update({
      where: { id: sessionId },
      data,
    });
    return { success: true };
  } catch (err: any) {
    console.error("updateSessionAction error:", err);
    return { error: err.message ?? "Failed to update session." };
  }
}

export async function deleteSessionAction(sessionId: string): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.session.delete({ where: { id: sessionId } });
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to delete session." };
  }
}

// ---------------------------------------------------------------------------
// 4. ATTENDANCE & EXCEL EXPORTS
// ---------------------------------------------------------------------------

export async function markAttendanceAction(
  sessionId: string,
  teacherId: string,
  status: AttendanceStatus = "present"
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.attendance.upsert({
      where: {
        sessionId_teacherId: { sessionId, teacherId },
      },
      create: {
        sessionId,
        teacherId,
        status,
        markedAt: new Date(),
      },
      update: {
        status,
        markedAt: new Date(),
      },
    });
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to mark attendance." };
  }
}

export async function deleteAttendanceAction(
  sessionId: string,
  teacherId: string
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.attendance.delete({
      where: {
        sessionId_teacherId: { sessionId, teacherId },
      },
    });
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to delete attendance." };
  }
}

export async function exportAttendanceExcelAction(
  sessionId: string,
  statusFilter: "present" | "absent"
): Promise<{ base64?: string; filename?: string; count?: number; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { categoryRules: true },
    });

    if (!targetSession) return { error: "Session not found." };

    const categoryTypes = targetSession.categoryRules.map((r) => r.categoryType);

    const eligibleTeachers = await prisma.teacher.findMany({
      where: {
        isActive: true,
        school: categoryTypes.length > 0 ? { categoryType: { in: categoryTypes } } : undefined,
      },
      include: {
        school: true,
        attendance: {
          where: { sessionId },
          select: { status: true, markedAt: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const filtered = eligibleTeachers.filter((t) => {
      const isPresent = t.attendance[0]?.status === "present";
      return statusFilter === "present" ? isPresent : !isPresent;
    });

    const excelData = filtered.map((t, idx) => ({
      "S.No": idx + 1,
      "Teacher Name": t.name ?? "Unassigned",
      "Mobile Number": t.mobile,
      "Subject / Role": t.subject ?? "NMMS Incharge",
      "School Name": t.school?.name ?? "N/A",
      "UDISE Code": t.schoolUdise,
      "Block": t.school?.block ?? "N/A",
      "District": t.school?.educationDistrict ?? "N/A",
      "School Category": t.school?.categoryType ? t.school.categoryType.replace("_", " ") : "N/A",
      "Attendance Status": statusFilter.toUpperCase(),
      "Marked Time": t.attendance[0]?.markedAt
        ? new Date(t.attendance[0].markedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
        : "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `${statusFilter.toUpperCase()} Teachers`);

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const base64 = buffer.toString("base64");
    const safeTitle = targetSession.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `NMMS_${safeTitle}_${statusFilter.toUpperCase()}_Teachers.xlsx`;

    return {
      base64,
      filename,
      count: filtered.length,
    };
  } catch (err: any) {
    console.error("exportAttendanceExcelAction error:", err);
    return { error: err.message ?? "Export failed." };
  }
}
