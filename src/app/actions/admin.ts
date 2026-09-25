"use server";

import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
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
  sessionType?: "HM" | "NMMS";
  includeBrte?: boolean;
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
        sessionType: input.sessionType || "NMMS",
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
        includeBrte: Boolean(input.includeBrte),
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

export interface UpdateSessionInput {
  title?: string;
  description?: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  generalMeetUrl?: string;
  isAttendanceOpen?: boolean;
  isPublished?: boolean;
  categoryTypes?: CategoryType[];
  schoolTypes?: string[];
  blocks?: string[];
  sessionType?: "HM" | "NMMS";
  includeBrte?: boolean;
}

export async function updateSessionAction(
  sessionId: string,
  data: UpdateSessionInput
): Promise<{ success?: true; updatedSession?: any; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Sync category rules if provided
      if (data.categoryTypes !== undefined) {
        await tx.sessionCategoryRule.deleteMany({ where: { sessionId } });
        if (data.categoryTypes.length > 0) {
          await tx.sessionCategoryRule.createMany({
            data: data.categoryTypes.map((categoryType) => ({ sessionId, categoryType })),
          });
        }
      }

      // 2. Sync school type rules if provided
      if (data.schoolTypes !== undefined) {
        await tx.sessionSchoolTypeRule.deleteMany({ where: { sessionId } });
        if (data.schoolTypes.length > 0) {
          await tx.sessionSchoolTypeRule.createMany({
            data: data.schoolTypes.map((schoolType) => ({ sessionId, schoolType })),
          });
        }
      }

      // 3. Sync block rules if provided
      if (data.blocks !== undefined) {
        await tx.sessionBlockRule.deleteMany({ where: { sessionId } });
        if (data.blocks.length > 0) {
          await tx.sessionBlockRule.createMany({
            data: data.blocks.map((block) => ({ sessionId, block })),
          });
        }
      }

      // 4. Parse date and times
      const sessionDate = data.sessionDate ? new Date(data.sessionDate) : undefined;
      const startTime =
        data.startTime !== undefined
          ? data.startTime
            ? new Date(`1970-01-01T${data.startTime}:00.000Z`)
            : null
          : undefined;
      const endTime =
        data.endTime !== undefined
          ? data.endTime
            ? new Date(`1970-01-01T${data.endTime}:00.000Z`)
            : null
          : undefined;

      // 5. Update session record
      return await tx.session.update({
        where: { id: sessionId },
        data: {
          ...(data.sessionType !== undefined && { sessionType: data.sessionType }),
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(sessionDate !== undefined && { sessionDate }),
          ...(startTime !== undefined && { startTime }),
          ...(endTime !== undefined && { endTime }),
          ...(data.generalMeetUrl !== undefined && { generalMeetUrl: data.generalMeetUrl }),
          ...(data.isAttendanceOpen !== undefined && { isAttendanceOpen: data.isAttendanceOpen }),
          ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
          ...(data.includeBrte !== undefined && { includeBrte: data.includeBrte }),
        },
        include: {
          categoryRules: true,
          schoolTypeRules: true,
          blockRules: true,
          _count: { select: { attendance: true, meetLinks: true } },
        },
      });
    });

    revalidatePath("/teacher/dashboard");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      updatedSession: {
        ...updated,
        sessionDate: updated.sessionDate.toISOString(),
        startTime: updated.startTime ? updated.startTime.toISOString() : null,
        endTime: updated.endTime ? updated.endTime.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
      },
    };
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
    workbook.creator = "CEO - Madurai | Gmeet Attendance Portal";
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

    // Order: ABSENT schools first, then PRESENT schools. Alphabetical by name within each group.
    const sortedSchools = [...eligibleSchools].sort((a, b) => {
      const aPresent = a.teachers[0]?.attendance?.[0]?.status === "present";
      const bPresent = b.teachers[0]?.attendance?.[0]?.status === "present";

      if (!aPresent && bPresent) return -1;
      if (aPresent && !bPresent) return 1;
      return (a.name || "").localeCompare(b.name || "");
    });

    sortedSchools.forEach((sc, idx) => {
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

    if (targetSession.includeBrte) {
      const allBrtes = await prisma.brte.findMany({
        where: { isActive: true },
        include: {
          sessionAttendance: {
            where: { sessionId },
            select: { status: true, markedAt: true },
          },
        },
        orderBy: [{ block: "asc" }, { name: "asc" }],
      });

      const brteSheet = workbook.addWorksheet("BRTE Attendance", {
        properties: { tabColor: { argb: "FFFFC000" } },
      });

      brteSheet.columns = [
        { header: "S.No", key: "sno", width: 8 },
        { header: "EMIS ID", key: "emis", width: 14 },
        { header: "BRTE Name", key: "name", width: 28 },
        { header: "Block", key: "block", width: 20 },
        { header: "Attendance Status", key: "status", width: 20 },
        { header: "Marked Time", key: "markedAt", width: 20 },
      ];

      const brteHeaderRow = brteSheet.getRow(1);
      brteHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      brteHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1B365D" },
      };
      brteHeaderRow.alignment = { vertical: "middle", horizontal: "center" };

      allBrtes.forEach((b, idx) => {
        const att = b.sessionAttendance[0];
        const isPresent = att?.status === "present";
        const row = brteSheet.addRow({
          sno: idx + 1,
          emis: b.emis,
          name: b.name,
          block: b.block || "N/A",
          status: isPresent ? "PRESENT" : "ABSENT",
          markedAt: att?.markedAt
            ? new Date(att.markedAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
              })
            : "—",
        });
        const statusCell = row.getCell("status");
        statusCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: isPresent ? "FFC6EFCE" : "FFFFC7CE" },
        };
        statusCell.font = {
          color: { argb: isPresent ? "FF006100" : "FF9C0006" },
          bold: true,
        };
      });
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const safeTitle = targetSession.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `CEO_Madurai_${safeTitle}_Attendance.xlsx`;

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
// 4B. EXPORT CONSOLIDATED ALL SESSIONS ATTENDANCE MATRIX
// ---------------------------------------------------------------------------

export async function exportConsolidatedAttendanceExcelAction(filters?: {
  categoryTypes?: CategoryType[];
  schoolTypes?: string[];
  blocks?: string[];
  sessionType?: "HM" | "NMMS";
  sessionIds?: string[];
}): Promise<{
  base64?: string;
  filename?: string;
  count?: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const sessionWhere: any = {};
    if (filters?.sessionType) {
      sessionWhere.sessionType = filters.sessionType;
    }
    if (filters?.sessionIds && filters.sessionIds.length > 0) {
      sessionWhere.id = { in: filters.sessionIds };
    }

    const allSessions = await prisma.session.findMany({
      where: sessionWhere,
      include: {
        categoryRules: true,
        schoolTypeRules: true,
        blockRules: true,
      },
      orderBy: { sessionDate: "asc" },
    });

    if (allSessions.length === 0) {
      return { error: `No ${filters?.sessionType ?? ""} training sessions found to export.` };
    }

    const schoolFilter: any = { isActive: true };
    if (filters?.categoryTypes && filters.categoryTypes.length > 0) {
      schoolFilter.categoryType = { in: filters.categoryTypes };
    }
    if (filters?.schoolTypes && filters.schoolTypes.length > 0) {
      schoolFilter.schoolType = { in: filters.schoolTypes };
    }
    if (filters?.blocks && filters.blocks.length > 0) {
      schoolFilter.block = { in: filters.blocks };
    }

    const allSchools = await prisma.school.findMany({
      where: schoolFilter,
      include: {
        teachers: {
          where: { isActive: true },
          take: 1,
          include: {
            attendance: {
              select: { sessionId: true, status: true },
            },
          },
        },
      },
      orderBy: [{ block: "asc" }, { name: "asc" }],
    });

    if (allSchools.length === 0) {
      return { error: "No schools found matching the selected filter criteria." };
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CEO - Madurai | Gmeet Attendance Portal";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Consolidated Attendance", {
      properties: { tabColor: { argb: "FF0072C6" } },
    });

    // Build base columns
    const columns: any[] = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "UDISE Code", key: "udise", width: 16 },
      { header: "School Name", key: "school", width: 38 },
      { header: "School Type", key: "schoolType", width: 20 },
      { header: "Management", key: "management", width: 28 },
      { header: "Block", key: "block", width: 18 },
      { header: "District", key: "district", width: 18 },
      { header: "Category Type", key: "category", width: 24 },
    ];

    // Dynamic session columns (one column per session)
    allSessions.forEach((s) => {
      const dateStr = new Date(s.sessionDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const colHeader = `${s.title} (${dateStr})`;
      columns.push({
        header: colHeader,
        key: `session_${s.id}`,
        width: Math.max(22, Math.min(38, colHeader.length + 2)),
      });
    });

    // Summary columns at the end
    columns.push(
      { header: "Total Present", key: "totalPresent", width: 16 },
      { header: "Total Absent", key: "totalAbsent", width: 16 }
    );

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sheet.getRow(1).height = 30;

    // Helper to evaluate session targeting rules
    function isSchoolEligible(school: any, targetSession: any): boolean {
      if (targetSession.categoryRules && targetSession.categoryRules.length > 0) {
        const cats = targetSession.categoryRules.map((r: any) => r.categoryType);
        if (!school.categoryType || !cats.includes(school.categoryType)) return false;
      }
      if (targetSession.schoolTypeRules && targetSession.schoolTypeRules.length > 0) {
        const types = targetSession.schoolTypeRules.map((r: any) => r.schoolType);
        if (!school.schoolType || !types.includes(school.schoolType)) return false;
      }
      if (targetSession.blockRules && targetSession.blockRules.length > 0) {
        const blks = targetSession.blockRules.map((r: any) => r.block);
        if (!school.block || !blks.includes(school.block)) return false;
      }
      return true;
    }

    // Process each school and calculate totals
    const evaluatedRows = allSchools.map((sc) => {
      const teacher = sc.teachers[0];
      const attendanceMap = new Map<string, string>();
      if (teacher?.attendance) {
        teacher.attendance.forEach((a: any) => {
          attendanceMap.set(a.sessionId, a.status);
        });
      }

      let totalPresent = 0;
      let totalAbsent = 0;
      const sessionValues: Record<string, string> = {};

      allSessions.forEach((s) => {
        const eligible = isSchoolEligible(sc, s);
        if (!eligible) {
          sessionValues[`session_${s.id}`] = "null";
        } else {
          const status = attendanceMap.get(s.id);
          if (status === "present") {
            sessionValues[`session_${s.id}`] = "PRESENT";
            totalPresent++;
          } else {
            sessionValues[`session_${s.id}`] = "ABSENT";
            totalAbsent++;
          }
        }
      });

      return {
        school: sc,
        sessionValues,
        totalPresent,
        totalAbsent,
      };
    });

    // Order: schools with more absences first, then present, then alphabetical by name
    evaluatedRows.sort((a, b) => {
      if (b.totalAbsent !== a.totalAbsent) {
        return b.totalAbsent - a.totalAbsent; // higher absences appear first
      }
      if (a.totalPresent !== b.totalPresent) {
        return a.totalPresent - b.totalPresent;
      }
      return (a.school.name || "").localeCompare(b.school.name || "");
    });

    evaluatedRows.forEach((item, idx) => {
      const sc = item.school;
      const rowData: any = {
        sno: idx + 1,
        udise: sc.udise,
        school: sc.name,
        schoolType: sc.schoolType ?? "N/A",
        management: sc.management ?? "N/A",
        block: sc.block ?? "N/A",
        district: sc.educationDistrict ?? "N/A",
        category: sc.categoryType ? sc.categoryType.replace("_", " ") : "N/A",
        ...item.sessionValues,
        totalPresent: item.totalPresent,
        totalAbsent: item.totalAbsent,
      };

      const row = sheet.addRow(rowData);

      // Style session cells
      allSessions.forEach((s) => {
        const val = item.sessionValues[`session_${s.id}`];
        const cell = row.getCell(`session_${s.id}`);
        cell.alignment = { horizontal: "center" };
        if (val === "PRESENT") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
          cell.font = { color: { argb: "FF006100" }, bold: true };
        } else if (val === "ABSENT") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
          cell.font = { color: { argb: "FF9C0006" }, bold: true };
        } else if (val === "null") {
          cell.font = { color: { argb: "FF888888" }, italic: true };
        }
      });

      // Style summary cells
      const presCell = row.getCell("totalPresent");
      presCell.font = { bold: true, color: { argb: "FF006100" } };
      presCell.alignment = { horizontal: "center" };

      const absCell = row.getCell("totalAbsent");
      absCell.font = { bold: true, color: { argb: "FF9C0006" } };
      absCell.alignment = { horizontal: "center" };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filterSuffix = filters?.schoolTypes && filters.schoolTypes.length > 0 
      ? `_${filters.schoolTypes.map((s: string) => s.replace(/[^a-zA-Z0-9]/g, "")).join("-")}`
      : "";
    const typePrefix = filters?.sessionType ? `${filters.sessionType}_` : "";
    const filename = `CEO_Madurai_${typePrefix}Master_Schools_Attendance_Matrix${filterSuffix}_${dateStamp}.xlsx`;

    return {
      base64,
      filename,
      count: allSchools.length,
    };
  } catch (err: any) {
    console.error("exportConsolidatedAttendanceExcelAction error:", err);
    return { error: err.message ?? "Consolidated export failed." };
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

// ---------------------------------------------------------------------------
// 6. BRTE SESSION MUTATIONS
// ---------------------------------------------------------------------------

export interface CreateBrteSessionInput {
  title: string;
  description?: string;
  sessionDate: string; // YYYY-MM-DD
  startTime?: string;  // HH:mm (24hr format)
  endTime?: string;    // HH:mm (24hr format)
  generalMeetUrl: string;
  blocks?: string[];   // Empty = all BRTEs
}

export async function createBrteSessionAction(
  input: CreateBrteSessionInput
): Promise<{ success?: true; createdSession?: any; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const sessionDate = new Date(input.sessionDate);
    const startTime = input.startTime ? new Date(`1970-01-01T${input.startTime}:00.000Z`) : null;
    const endTime = input.endTime ? new Date(`1970-01-01T${input.endTime}:00.000Z`) : null;

    const createdSession = await prisma.brteSession.create({
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
        blockRules: {
          create: (input.blocks || []).map((block) => ({ block })),
        },
      },
      include: { blockRules: true },
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
    console.error("createBrteSessionAction error:", err);
    return { error: err.message ?? "Failed to create BRTE session." };
  }
}

export interface UpdateBrteSessionInput {
  title?: string;
  description?: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  generalMeetUrl?: string;
  isAttendanceOpen?: boolean;
  isPublished?: boolean;
  blocks?: string[];
}

export async function updateBrteSessionAction(
  sessionId: string,
  data: UpdateBrteSessionInput
): Promise<{ success?: true; updatedSession?: any; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (data.blocks !== undefined) {
        await tx.brteSessionBlockRule.deleteMany({ where: { sessionId } });
        if (data.blocks.length > 0) {
          await tx.brteSessionBlockRule.createMany({
            data: data.blocks.map((block) => ({ sessionId, block })),
          });
        }
      }

      const sessionDate = data.sessionDate ? new Date(data.sessionDate) : undefined;
      const startTime =
        data.startTime !== undefined
          ? data.startTime
            ? new Date(`1970-01-01T${data.startTime}:00.000Z`)
            : null
          : undefined;
      const endTime =
        data.endTime !== undefined
          ? data.endTime
            ? new Date(`1970-01-01T${data.endTime}:00.000Z`)
            : null
          : undefined;

      return await tx.brteSession.update({
        where: { id: sessionId },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(sessionDate !== undefined && { sessionDate }),
          ...(startTime !== undefined && { startTime }),
          ...(endTime !== undefined && { endTime }),
          ...(data.generalMeetUrl !== undefined && { generalMeetUrl: data.generalMeetUrl }),
          ...(data.isAttendanceOpen !== undefined && { isAttendanceOpen: data.isAttendanceOpen }),
          ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
        },
        include: {
          blockRules: true,
          _count: { select: { attendance: true } },
        },
      });
    });

    revalidatePath("/brte/dashboard");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      updatedSession: {
        ...updated,
        sessionDate: updated.sessionDate.toISOString(),
        startTime: updated.startTime ? updated.startTime.toISOString() : null,
        endTime: updated.endTime ? updated.endTime.toISOString() : null,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  } catch (err: any) {
    console.error("updateBrteSessionAction error:", err);
    return { error: err.message ?? "Failed to update BRTE session." };
  }
}

export async function deleteBrteSessionAction(sessionId: string): Promise<{ success?: true; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    await prisma.brteSession.delete({ where: { id: sessionId } });
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to delete BRTE session." };
  }
}

export async function markBrteAttendanceAction(
  sessionId: string,
  brteId: string,
  status: AttendanceStatus = "present"
): Promise<{ success?: true; error?: string }> {
  try {
    await prisma.brteAttendance.upsert({
      where: { sessionId_brteId: { sessionId, brteId } },
      update: { status, markedAt: new Date() },
      create: { sessionId, brteId, status, markedAt: new Date() },
    });
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? "Failed to mark BRTE attendance." };
  }
}

export async function exportBrteAttendanceExcelAction(
  sessionId: string
): Promise<{ base64?: string; filename?: string; count?: number; error?: string }> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const targetSession = await prisma.brteSession.findUnique({
      where: { id: sessionId },
      include: { blockRules: true },
    });

    if (!targetSession) return { error: "BRTE Session not found." };

    const blocks = targetSession.blockRules.map((r) => r.block);

    // Fetch all targeted BRTEs
    const eligibleBrtes = await prisma.brte.findMany({
      where: {
        isActive: true,
        ...(blocks.length > 0 ? { block: { in: blocks } } : {}),
      },
      include: {
        attendance: {
          where: { sessionId },
          select: { status: true, markedAt: true },
        },
      },
      orderBy: [{ block: "asc" }, { name: "asc" }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CEO - Madurai | Gmeet Attendance Portal";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("BRTE Attendance", {
      properties: { tabColor: { argb: "FF6B21A8" } },
    });

    sheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "BRTE EMIS ID", key: "emis", width: 15 },
      { header: "BRTE Name", key: "name", width: 35 },
      { header: "Block", key: "block", width: 20 },
      { header: "Attendance Status", key: "status", width: 20 },
      { header: "Marked Time", key: "markedAt", width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };

    // Order: ABSENT BRTEs first, then PRESENT BRTEs. Ordered by block and name within each group.
    const sortedBrtes = [...eligibleBrtes].sort((a, b) => {
      const aPresent = a.attendance?.[0]?.status === "present";
      const bPresent = b.attendance?.[0]?.status === "present";

      if (!aPresent && bPresent) return -1;
      if (aPresent && !bPresent) return 1;
      const blockComp = (a.block || "").localeCompare(b.block || "");
      if (blockComp !== 0) return blockComp;
      return (a.name || "").localeCompare(b.name || "");
    });

    sortedBrtes.forEach((brte, idx) => {
      const attendanceRecord = brte.attendance?.[0];
      const isPresent = attendanceRecord?.status === "present";
      const statusText = attendanceRecord ? (isPresent ? "PRESENT" : "ABSENT") : "ABSENT";

      const row = sheet.addRow({
        sno: idx + 1,
        emis: brte.emis,
        name: brte.name,
        block: brte.block ?? "N/A",
        status: statusText,
        markedAt: attendanceRecord?.markedAt
          ? new Date(attendanceRecord.markedAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
              timeZone: "Asia/Kolkata",
            })
          : "—",
      });

      const statusCell = row.getCell("status");
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isPresent ? "FFC6EFCE" : "FFFFC7CE" } };
      statusCell.font = { color: { argb: isPresent ? "FF006100" : "FF9C0006" }, bold: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const safeTitle = targetSession.title.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `CEO_Madurai_BRTE_${safeTitle}_Attendance.xlsx`;

    return { base64, filename, count: eligibleBrtes.length };
  } catch (err: any) {
    console.error("exportBrteAttendanceExcelAction error:", err);
    return { error: err.message ?? "Export failed." };
  }
}

// ---------------------------------------------------------------------------
// 6B. EXPORT CONSOLIDATED BRTE SESSIONS ATTENDANCE MATRIX
// ---------------------------------------------------------------------------

export async function exportConsolidatedBrteAttendanceExcelAction(filters?: {
  sessionIds?: string[];
}): Promise<{
  base64?: string;
  filename?: string;
  count?: number;
  error?: string;
}> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { error: "Unauthorized." };

  try {
    const brteSessionWhere: any = {};
    if (filters?.sessionIds && filters.sessionIds.length > 0) {
      brteSessionWhere.id = { in: filters.sessionIds };
    }

    const allBrteSessions = await prisma.brteSession.findMany({
      where: brteSessionWhere,
      include: { blockRules: true },
      orderBy: { sessionDate: "asc" },
    });

    if (allBrteSessions.length === 0) {
      return { error: "No BRTE training sessions found to export." };
    }

    const allBrtes = await prisma.brte.findMany({
      where: { isActive: true },
      include: {
        attendance: {
          select: { sessionId: true, status: true },
        },
      },
      orderBy: [{ block: "asc" }, { name: "asc" }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CEO - Madurai | Gmeet Attendance Portal";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Consolidated BRTE Attendance", {
      properties: { tabColor: { argb: "FF6B21A8" } },
    });

    // Build base columns
    const columns: any[] = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "BRTE EMIS ID", key: "emis", width: 16 },
      { header: "BRTE Name", key: "name", width: 35 },
      { header: "Block", key: "block", width: 20 },
    ];

    // Dynamic session columns (one column per BRTE session)
    allBrteSessions.forEach((s) => {
      const dateStr = new Date(s.sessionDate).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const colHeader = `${s.title} (${dateStr})`;
      columns.push({
        header: colHeader,
        key: `session_${s.id}`,
        width: Math.max(22, Math.min(38, colHeader.length + 2)),
      });
    });

    // Summary columns at the end
    columns.push(
      { header: "Total Present", key: "totalPresent", width: 16 },
      { header: "Total Absent", key: "totalAbsent", width: 16 }
    );

    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    sheet.getRow(1).height = 30;

    // Process each BRTE and calculate totals
    const evaluatedRows = allBrtes.map((brte) => {
      const attendanceMap = new Map<string, string>();
      if (brte.attendance) {
        brte.attendance.forEach((a: any) => {
          attendanceMap.set(a.sessionId, a.status);
        });
      }

      let totalPresent = 0;
      let totalAbsent = 0;
      const sessionValues: Record<string, string> = {};

      allBrteSessions.forEach((s) => {
        const targetBlocks = s.blockRules.map((r: any) => r.block);
        const isEligible = targetBlocks.length === 0 || (brte.block && targetBlocks.includes(brte.block));

        if (!isEligible) {
          sessionValues[`session_${s.id}`] = "null";
        } else {
          const status = attendanceMap.get(s.id);
          if (status === "present") {
            sessionValues[`session_${s.id}`] = "PRESENT";
            totalPresent++;
          } else {
            sessionValues[`session_${s.id}`] = "ABSENT";
            totalAbsent++;
          }
        }
      });

      return {
        brte,
        sessionValues,
        totalPresent,
        totalAbsent,
      };
    });

    // Order: BRTEs with more absences first, then present, then alphabetical by name
    evaluatedRows.sort((a, b) => {
      if (b.totalAbsent !== a.totalAbsent) {
        return b.totalAbsent - a.totalAbsent;
      }
      if (a.totalPresent !== b.totalPresent) {
        return a.totalPresent - b.totalPresent;
      }
      return (a.brte.name || "").localeCompare(b.brte.name || "");
    });

    evaluatedRows.forEach((item, idx) => {
      const brte = item.brte;
      const rowData: any = {
        sno: idx + 1,
        emis: brte.emis,
        name: brte.name,
        block: brte.block ?? "N/A",
        ...item.sessionValues,
        totalPresent: item.totalPresent,
        totalAbsent: item.totalAbsent,
      };

      const row = sheet.addRow(rowData);

      // Style session cells
      allBrteSessions.forEach((s) => {
        const val = item.sessionValues[`session_${s.id}`];
        const cell = row.getCell(`session_${s.id}`);
        cell.alignment = { horizontal: "center" };
        if (val === "PRESENT") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
          cell.font = { color: { argb: "FF006100" }, bold: true };
        } else if (val === "ABSENT") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
          cell.font = { color: { argb: "FF9C0006" }, bold: true };
        } else if (val === "null") {
          cell.font = { color: { argb: "FF888888" }, italic: true };
        }
      });

      // Style summary cells
      const presCell = row.getCell("totalPresent");
      presCell.font = { bold: true, color: { argb: "FF006100" } };
      presCell.alignment = { horizontal: "center" };

      const absCell = row.getCell("totalAbsent");
      absCell.font = { bold: true, color: { argb: "FF9C0006" } };
      absCell.alignment = { horizontal: "center" };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dateStamp = new Date().toISOString().slice(0, 10);
    const filename = `CEO_Madurai_All_BRTE_Sessions_Consolidated_Attendance_${dateStamp}.xlsx`;

    return {
      base64,
      filename,
      count: allBrtes.length,
    };
  } catch (err: any) {
    console.error("exportConsolidatedBrteAttendanceExcelAction error:", err);
    return { error: err.message ?? "Consolidated BRTE export failed." };
  }
}
