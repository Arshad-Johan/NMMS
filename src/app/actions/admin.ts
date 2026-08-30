"use server";

import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
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
  schoolTypes?: string[];
  blocks?: string[];
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
}): Promise<{ success?: true; createdTeacher?: any; error?: string }> {
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
    const createdTeacher = await prisma.teacher.create({
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
    return {
      success: true,
      createdTeacher: {
        ...createdTeacher,
        createdAt: createdTeacher.createdAt.toISOString(),
        lastAdminUpdate: createdTeacher.lastAdminUpdate ? createdTeacher.lastAdminUpdate.toISOString() : null,
      },
    };
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
  district?: string;
  educationDistrict?: string;
  block?: string;
  schoolType?: string;
  management?: string;
  category?: string;
  categoryType?: CategoryType | null;
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
        district: data.district ?? "MADURAI",
        educationDistrict: data.educationDistrict ?? null,
        block: data.block ?? null,
        schoolType: data.schoolType ?? null,
        management: data.management ?? null,
        category: data.category ?? null,
        categoryType: data.categoryType ?? null,
        isActive: data.isActive ?? true,
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
    district?: string;
    educationDistrict?: string;
    block?: string;
    schoolType?: string;
    management?: string;
    category?: string;
    categoryType?: CategoryType | null;
    isActive?: boolean;
  }
): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.school.update({
      where: { udise },
      data,
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
          create: (input.categoryTypes || []).map((categoryType) => ({ categoryType })),
        },
        schoolTypeRules: {
          create: (input.schoolTypes || []).map((schoolType) => ({ schoolType })),
        },
        blockRules: {
          create: (input.blocks || []).map((block) => ({ block })),
        },
      },
      include: {
        categoryRules: true,
        schoolTypeRules: true,
        blockRules: true,
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
// 4. ATTENDANCE ACTIONS
// ---------------------------------------------------------------------------

export async function markAttendanceAction(
  sessionId: string,
  teacherId: string,
  status: AttendanceStatus = "present"
): Promise<{ success?: true; error?: string }> {
  try {
    await prisma.attendance.upsert({
      where: {
        sessionId_teacherId: { sessionId, teacherId },
      },
      update: {
        status,
        markedAt: new Date(),
      },
      create: {
        sessionId,
        teacherId,
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
  sessionId: string
): Promise<{ base64?: string; filename?: string; count?: number; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const targetSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { categoryRules: true, schoolTypeRules: true, blockRules: true },
    });

    if (!targetSession) return { error: "Session not found." };

    const categoryTypes = targetSession.categoryRules.map((r) => r.categoryType);
    const schoolTypes = targetSession.schoolTypeRules.map((r) => r.schoolType);
    const blocks = targetSession.blockRules.map((r) => r.block);

    // Query ALL targeted schools (not teachers) so every school appears in the export
    const eligibleSchools = await prisma.school.findMany({
      where: {
        isActive: true,
        ...(categoryTypes.length > 0 ? { categoryType: { in: categoryTypes } } : {}),
        ...(schoolTypes.length > 0 ? { schoolType: { in: schoolTypes } } : {}),
        ...(blocks.length > 0 ? { block: { in: blocks } } : {}),
      },
      include: {
        teachers: {
          where: { isActive: true },
          take: 1,
          include: {
            attendance: {
              where: { sessionId },
              select: { status: true, markedAt: true },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "NMMS Portal";
    workbook.created = new Date();
    
    const sheet = workbook.addWorksheet("Attendance", {
      properties: { tabColor: { argb: "FF0072C6" } }
    });
    
    sheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "UDISE Code", key: "udise", width: 15 },
      { header: "School Name", key: "school", width: 40 },
      { header: "School Type", key: "schoolType", width: 25 },
      { header: "Management", key: "management", width: 30 },
      { header: "Block", key: "block", width: 20 },
      { header: "District", key: "district", width: 20 },
      { header: "Category Type", key: "category", width: 25 },
      { header: "Attendance Status", key: "status", width: 20 },
      { header: "Marked Time", key: "markedAt", width: 15 },
    ];
    
    sheet.getRow(1).font = { bold: true };

    eligibleSchools.forEach((sc, idx) => {
      const teacher = sc.teachers[0];
      const attendanceRecord = teacher?.attendance?.[0];
      const isPresent = attendanceRecord?.status === "present";
      const statusText = attendanceRecord ? (isPresent ? "PRESENT" : "ABSENT") : "ABSENT";
      
      const row = sheet.addRow({
        sno: idx + 1,
        udise: sc.udise,
        school: sc.name,
        schoolType: sc.schoolType ?? "N/A",
        management: sc.management ?? "N/A",
        block: sc.block ?? "N/A",
        district: sc.educationDistrict ?? "N/A",
        category: sc.categoryType ? sc.categoryType.replace("_", " ") : "N/A",
        status: statusText,
        markedAt: attendanceRecord?.markedAt
          ? new Date(attendanceRecord.markedAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })
          : "—"
      });
      
      const statusCell = row.getCell("status");
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isPresent ? "FFC6EFCE" : "FFFFC7CE" } };
      statusCell.font = { color: { argb: isPresent ? "FF006100" : "FF9C0006" }, bold: true };
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const safeTitle = targetSession.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `NMMS_${safeTitle}_Attendance.xlsx`;

    return {
      base64,
      filename,
      count: eligibleSchools.length,
    };
  } catch (err: any) {
    console.error("exportAttendanceExcelAction error:", err);
    return { error: err.message ?? "Export failed." };
  }
}

// ---------------------------------------------------------------------------
// 5. EXPORT TRAINERS LIST
// ---------------------------------------------------------------------------

export async function exportTrainersExcelAction(): Promise<{ base64?: string; filename?: string; count?: number; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const trainers = await prisma.teacher.findMany({
      include: { school: true },
      orderBy: { name: "asc" },
    });

    const excelData = trainers.map((t, idx) => ({
      "S.No": idx + 1,
      "Trainer Name": t.name ?? "Unassigned",
      "Mobile Number": t.mobile,
      "Role / Subject": t.subject ?? "NMMS Incharge",
      "School Name": t.school?.name ?? "N/A",
      "School Type": t.school?.schoolType ?? "N/A",
      "UDISE Code": t.schoolUdise,
      "Block": t.school?.block ?? "N/A",
      "District": t.school?.educationDistrict ?? "N/A",
      "School Category": t.school?.categoryType ? t.school.categoryType.replace("_", " ") : "N/A",
      "Status": t.isActive ? "Active" : "Inactive",
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NMMS Trainers");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const base64 = buffer.toString("base64");
    const filename = `NMMS_Trainers_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return { base64, filename, count: trainers.length };
  } catch (err: any) {
    console.error("exportTrainersExcelAction error:", err);
    return { error: err.message ?? "Export failed." };
  }
}
