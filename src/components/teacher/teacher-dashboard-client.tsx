"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { markMyAttendanceAction } from "@/app/actions/teacher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from "@/components/ui/table";
import {
  GraduationCap,
  LogOut,
  Calendar,
  CheckCircle2,
  XCircle,
  BarChart3,
  Video,
  Clock,
  Building2,
  MapPin,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  History
} from "lucide-react";

interface TeacherDashboardClientProps {
  teacher: {
    id: string;
    name: string | null;
    mobile: string;
    subject: string | null;
    schoolUdise: string;
    school: {
      name: string;
      udise: string;
      block: string | null;
      educationDistrict: string | null;
      categoryType: string | null;
    };
  };
  stats: {
    totalAttendance: number;
    presentCount: number;
    absentCount: number;
    attendanceRate: number | null;
  };
  assignedSessions: Array<{
    id: string;
    title: string;
    description: string | null;
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    generalMeetUrl: string;
    isAttendanceOpen: boolean;
    userAttendance: { status: string; markedAt: Date | string | null } | null;
  }>;
  recentAttendance: Array<{
    id: string;
    status: string;
    markedAt: string | null;
    session: {
      title: string;
      sessionDate: string;
    };
  }>;
}

function formatSessionTimeString(startTime?: string | null, endTime?: string | null) {
  if (!startTime) return null;
  try {
    const start = new Date(startTime).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
    if (!endTime) return start;
    const end = new Date(endTime).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    });
    return `${start} - ${end}`;
  } catch (e) {
    return null;
  }
}

function isSessionExpired(sessionDateStr: string, endTimeStr?: string | null, startTimeStr?: string | null): boolean {
  if (!sessionDateStr) return false;
  try {
    const sDate = new Date(sessionDateStr);
    const year = sDate.getUTCFullYear();
    const month = sDate.getUTCMonth();
    const day = sDate.getUTCDate();

    let endHours = 23;
    let endMinutes = 59;
    let endSeconds = 59;

    if (endTimeStr) {
      const eDate = new Date(endTimeStr);
      endHours = eDate.getUTCHours();
      endMinutes = eDate.getUTCMinutes();
    } else if (startTimeStr) {
      const stDate = new Date(startTimeStr);
      endHours = (stDate.getUTCHours() + 2) % 24;
      endMinutes = stDate.getUTCMinutes();
    }

    const sessionEndTime = new Date(year, month, day, endHours, endMinutes, endSeconds, 999);
    const now = new Date();

    return now.getTime() > sessionEndTime.getTime();
  } catch (e) {
    return false;
  }
}

export default function TeacherDashboardClient({
  teacher,
  stats: initialStats,
  assignedSessions: initialAssignedSessions,
  recentAttendance: initialRecentAttendance,
}: TeacherDashboardClientProps) {
  const router = useRouter();
  const [assignedSessions, setAssignedSessions] = useState(initialAssignedSessions);
  const [isPending, startTransition] = useTransition();

  const initials = teacher.name
    ? teacher.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "TC";

  // Dynamic calculation of stats including expired missed sessions
  let presentCount = 0;
  let missedCount = 0;
  const combinedHistory: Array<{
    id: string;
    title: string;
    sessionDate: string;
    markedAt: string | null;
    status: "present" | "absent";
  }> = [];

  assignedSessions.forEach((s) => {
    const isPresent = s.userAttendance?.status === "present";
    const isExpired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);

    if (isPresent) {
      presentCount += 1;
      combinedHistory.push({
        id: s.id,
        title: s.title,
        sessionDate: s.sessionDate,
        markedAt: s.userAttendance?.markedAt ? new Date(s.userAttendance.markedAt).toISOString() : null,
        status: "present",
      });
    } else if (isExpired) {
      missedCount += 1;
      combinedHistory.push({
        id: s.id,
        title: s.title,
        sessionDate: s.sessionDate,
        markedAt: null,
        status: "absent",
      });
    }
  });

  const totalEvaluatedSessions = presentCount + missedCount;
  const attendanceRate =
    totalEvaluatedSessions > 0
      ? Math.round((presentCount / totalEvaluatedSessions) * 100)
      : null;

  function handleJoinAndMark(sessionId: string, generalMeetUrl: string, isExpired: boolean) {
    if (isExpired) {
      toast.error("This session schedule has ended and is expired.");
      return;
    }

    // 1. Open Google Meet link in new tab immediately
    window.open(generalMeetUrl, "_blank", "noopener,noreferrer");

    // 2. Mark attendance as present on server
    startTransition(async () => {
      const res = await markMyAttendanceAction(sessionId);
      if (res.error) {
        toast.error(`Could not record attendance: ${res.error}`);
      } else {
        toast.success("Attendance marked as Present!");
        setAssignedSessions(
          assignedSessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  userAttendance: { status: "present", markedAt: new Date().toISOString() },
                }
              : s
          )
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* ── Header Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="font-semibold text-sm sm:text-base tracking-tight text-white block leading-none truncate">
                NMMS Portal
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium tracking-wider text-slate-400 uppercase truncate block">
                Teacher Dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-xs sm:text-sm font-semibold text-white leading-tight">
                  {teacher.name ?? "Teacher"}
                </div>
                <div className="text-[11px] text-slate-400 font-normal">
                  +91 {teacher.mobile}
                </div>
              </div>
            </div>

            <form action={logoutAction}>
              <Button
                variant="outline"
                size="sm"
                type="submit"
                className="gap-1 text-xs px-2.5 sm:px-3 h-8 sm:h-9 text-slate-300 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 font-medium"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Welcome Hero Banner */}
        <Card className="border-slate-800 bg-slate-900/60 relative overflow-hidden">
          <CardHeader className="sm:flex-row sm:items-center sm:justify-between gap-3 p-4 sm:p-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-medium text-indigo-400">
                <Sparkles className="w-3.5 h-3.5" /> Welcome back
              </div>
              <CardTitle className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                {teacher.name ?? "Teacher"}
              </CardTitle>
              <CardDescription className="text-slate-300 font-normal flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm pt-1">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {teacher.school.name}
                </span>
                <span className="text-slate-600 hidden sm:inline">•</span>
                <span className="font-mono text-slate-400 text-xs block sm:inline">
                  UDISE: {teacher.schoolUdise}
                </span>
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
              {teacher.school.categoryType && (
                <Badge variant="outline" className="text-[11px] sm:text-xs border-indigo-500/30 text-indigo-300 bg-indigo-500/10">
                  {teacher.school.categoryType.replace("_", " ")}
                </Badge>
              )}
              {teacher.school.block && (
                <Badge variant="secondary" className="text-[11px] sm:text-xs">
                  <MapPin className="w-3 h-3 mr-1" />
                  {teacher.school.block}
                </Badge>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Attendance Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardContent className="p-3.5 sm:p-5 flex items-center justify-between">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">
                  Total Sessions
                </p>
                <p className="text-xl sm:text-2xl font-semibold text-white">
                  {totalEvaluatedSessions}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/60">
            <CardContent className="p-3.5 sm:p-5 flex items-center justify-between">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">
                  Attended
                </p>
                <p className="text-xl sm:text-2xl font-semibold text-emerald-400">
                  {presentCount}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/60">
            <CardContent className="p-3.5 sm:p-5 flex items-center justify-between">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">
                  Missed
                </p>
                <p className="text-xl sm:text-2xl font-semibold text-red-400">
                  {missedCount}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/60">
            <CardContent className="p-3.5 sm:p-5 flex items-center justify-between">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-slate-400">
                  Rate
                </p>
                <p className="text-xl sm:text-2xl font-semibold text-indigo-400">
                  {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── SCHEDULED NMMS TRAINING SESSIONS SECTION ── */}
        <Card className="border-indigo-500/30 bg-slate-900/90 shadow-lg">
          <CardHeader className="pb-3 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
                  <Video className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                  Scheduled NMMS Training Sessions
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs font-normal mt-0.5">
                  All training sessions scheduled for your school & district
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-indigo-400 border-indigo-500/30 w-fit text-[11px]">
                {assignedSessions.length} Active
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {assignedSessions.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium text-slate-300">No scheduled sessions today</p>
                <p className="text-xs text-slate-500">Upcoming training sessions will appear here when scheduled by admins.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[550px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session Title</TableHead>
                      <TableHead>Date & Timing</TableHead>
                      <TableHead>Attendance Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assignedSessions.map((sessionItem) => {
                      const isPresent = sessionItem.userAttendance?.status === "present";
                      const formattedTime = formatSessionTimeString(sessionItem.startTime, sessionItem.endTime);
                      const expired = isSessionExpired(sessionItem.sessionDate, sessionItem.endTime, sessionItem.startTime);

                      return (
                        <TableRow key={sessionItem.id}>
                          <TableCell className="font-medium text-white max-w-xs">
                            <div className="font-semibold text-slate-100">{sessionItem.title}</div>
                            {sessionItem.description && (
                              <div className="text-xs text-slate-400 line-clamp-1">{sessionItem.description}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-300 text-xs whitespace-nowrap">
                            <div className="font-medium text-slate-200">
                              {new Date(sessionItem.sessionDate).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            {formattedTime && (
                              <div className="text-[11px] text-indigo-300 font-mono flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-indigo-400" /> {formattedTime}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {isPresent ? (
                              <Badge variant="success" className="gap-1 font-semibold text-xs">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Present
                              </Badge>
                            ) : expired ? (
                              <Badge variant="destructive" className="text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/30 gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Absent
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs text-amber-400 bg-amber-500/10 border-amber-500/30">
                                Not Marked Yet
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {expired ? (
                                <Badge variant="outline" className="text-xs border-red-500/30 text-red-400 bg-red-500/10 px-3 py-1 font-medium gap-1">
                                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                                  Expired
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleJoinAndMark(sessionItem.id, sessionItem.generalMeetUrl, expired)}
                                  className="h-9 px-3 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-sm"
                                >
                                  <Video className="w-3.5 h-3.5" />
                                  Join Google Meet
                                  <ExternalLink className="w-3 h-3 ml-0.5 opacity-80" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance History (Shows PRESENT & ABSENT) */}
        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="pb-3 p-4 sm:p-6">
            <CardTitle className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-400" /> Recent Attendance History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {combinedHistory.length === 0 ? (
              <div className="py-6 px-4 text-center text-xs text-slate-500">
                No completed or evaluated sessions yet.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <Table className="min-w-[480px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Marked Time</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combinedHistory.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-white">{a.title}</TableCell>
                        <TableCell className="text-slate-400 text-xs whitespace-nowrap">
                          {new Date(a.sessionDate).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </TableCell>
                        <TableCell className="text-slate-400 font-mono text-xs whitespace-nowrap">
                          {a.markedAt
                            ? new Date(a.markedAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Expired / Unmarked"}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {a.status === "present" ? (
                            <Badge variant="success" className="text-[10px]">
                              PRESENT
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/30">
                              ABSENT
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
