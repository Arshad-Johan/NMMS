"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
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
  History,
  Landmark,
  BookOpen,
  ArrowRight,
  X
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
      schoolType?: string | null;
      headOfSchool?: {
        name: string | null;
        mobile: string | null;
        hosType?: string | null;
      } | null;
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
    sessionType?: string;
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
  const [selectedMeetingType, setSelectedMeetingType] = useState<"NMMS" | "HM">("NMMS");
  const [isMeetingTypeModalOpen, setIsMeetingTypeModalOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  const nmmsOnlineClasses = useMemo(
    () => assignedSessions.filter((s) => s.sessionType !== "HM"),
    [assignedSessions]
  );

  const hmSessions = useMemo(
    () => assignedSessions.filter((s) => s.sessionType === "HM"),
    [assignedSessions]
  );

  const activeSessionsList = useMemo(() => {
    if (selectedMeetingType === "HM") return hmSessions;
    return nmmsOnlineClasses;
  }, [selectedMeetingType, hmSessions, nmmsOnlineClasses]);

  useEffect(() => {
    if (!isMeetingTypeModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMeetingTypeModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMeetingTypeModalOpen]);

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

  function handleJoinAndMark(sessionId: string, generalMeetUrl: string, isExpired: boolean, isPresent?: boolean) {
    if (isExpired) {
      toast.error("This session schedule has ended and is expired.");
      return;
    }

    // 1. Open Google Meet link in new tab immediately
    window.open(generalMeetUrl, "_blank", "noopener,noreferrer");

    // If attendance is already recorded as present, skip re-submitting attendance
    if (isPresent) {
      toast.success("Opening Google Meet...");
      return;
    }

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
    <div className="min-h-screen bg-[hsl(220,14%,96%)] text-gray-900 font-sans flex flex-col">
      {/* ── POPUP MODAL FOR SELECTING MEETING TYPE ON TEACHER SIGN IN ── */}
      {isMeetingTypeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meeting-type-popup-title"
          onClick={() => setIsMeetingTypeModalOpen(false)}
        >
          <div
            className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top brand stripe */}
            <div className="h-2 w-full bg-gradient-to-r from-[hsl(213,56%,24%)] via-[hsl(40,80%,50%)] to-[hsl(213,56%,24%)]" />

            {/* Close button */}
            <button
              type="button"
              onClick={() => setIsMeetingTypeModalOpen(false)}
              aria-label="Close dialog"
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="text-center max-w-lg mx-auto space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Select Meeting Type to Join
                </div>
                <h3
                  id="meeting-type-popup-title"
                  className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight"
                >
                  Which meeting are you attending today?
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Please select whether you are attending <strong>NMMS Online Class</strong> or an <strong>HM Meeting</strong>. Upon clicking, only the meeting links scheduled for your school UDISE will be displayed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto pt-1">
                {/* Option 1: NMMS Online Class */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMeetingType("NMMS");
                    setIsMeetingTypeModalOpen(false);
                  }}
                  className={`group relative bg-white border-2 rounded-xl p-5 shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-[hsl(213,56%,24%)] focus:ring-offset-2 ${
                    selectedMeetingType === "NMMS"
                      ? "border-[hsl(213,56%,24%)] ring-1 ring-[hsl(213,56%,24%)]"
                      : "border-gray-200 hover:border-[hsl(213,56%,24%)]"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="h-11 w-11 rounded-xl bg-[hsl(213,45%,94%)] text-[hsl(213,56%,24%)] flex items-center justify-center group-hover:bg-[hsl(213,56%,24%)] group-hover:text-white transition-colors">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 group-hover:text-[hsl(213,56%,24%)] transition-colors">
                        NMMS Online Class
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        NMMS online classes, subject training, and student coaching sessions.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[hsl(213,56%,24%)]">
                    <span>View NMMS Online Class</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>

                {/* Option 2: HM Meeting */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMeetingType("HM");
                    setIsMeetingTypeModalOpen(false);
                  }}
                  className={`group relative bg-white border-2 rounded-xl p-5 shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                    selectedMeetingType === "HM"
                      ? "border-indigo-600 ring-1 ring-indigo-600"
                      : "border-gray-200 hover:border-indigo-600"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="h-11 w-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">
                        HM Meeting
                      </h4>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Head Master, Head Teacher, and Principal administrative review meetings.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-indigo-600">
                    <span>View HM Meetings</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsMeetingTypeModalOpen(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-medium transition-colors"
                >
                  Close &amp; View Portal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Header Navbar ── */}
      <header className="sticky top-0 z-40 bg-[hsl(213,56%,24%)] shadow-md">
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[hsl(40,80%,50%)]" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight truncate">
                CEO - Madurai
              </span>
              <span className="text-[10px] font-bold text-[hsl(40,80%,50%)] uppercase tracking-wider block truncate">
                Gmeet Attendance Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9 ring-white/30">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-white leading-tight">
                  {teacher.name ?? "Teacher"}
                </div>
                <div className="text-xs text-white/70 font-medium">
                  UDISE: {teacher.schoolUdise}
                </div>
              </div>
            </div>

            <form action={logoutAction}>
              <Button
                variant="outline"
                size="sm"
                type="submit"
                className="gap-2 text-xs h-9 border-white/20 text-white/80 hover:bg-white/10 hover:text-white bg-transparent font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome Hero Banner */}
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-[hsl(213,56%,24%)] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-bold text-[hsl(213,56%,24%)] uppercase tracking-wider">
                CEO - Madurai | Gmeet Attendance Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                {teacher.name ?? "Teacher"}
              </h1>
              <div className="text-gray-600 font-medium flex flex-wrap items-center gap-x-3 gap-y-2 text-sm pt-1">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  {teacher.school.name}
                </span>
                <span className="text-gray-300 hidden sm:inline">|</span>
                <span className="font-mono text-gray-500">
                  UDISE: {teacher.schoolUdise}
                </span>
                {teacher.school.headOfSchool?.mobile && (
                  <>
                    <span className="text-gray-300 hidden sm:inline">|</span>
                    <span className="text-gray-600 font-mono text-xs bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                      HM Phone: {teacher.school.headOfSchool.mobile}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
              {teacher.school.categoryType && (
                <Badge variant="outline" className="bg-[hsl(213,45%,94%)] text-[hsl(213,56%,30%)] border-[hsl(213,45%,85%)] w-fit">
                  {teacher.school.categoryType.replace("_", " ")}
                </Badge>
              )}
              {teacher.school.schoolType && (
                <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 w-fit">
                  {teacher.school.schoolType}
                </Badge>
              )}
              {teacher.school.block && (
                <Badge variant="outline" className="bg-gray-50 text-gray-700 w-fit">
                  <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                  {teacher.school.block}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Attendance Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                  Total Sessions
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {totalEvaluatedSessions}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-[hsl(213,45%,94%)] text-[hsl(213,56%,24%)] shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                  Attended
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {presentCount}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-emerald-50 text-emerald-700 shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                  Missed
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {missedCount}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-red-50 text-red-700 shrink-0">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
                  Rate
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-[hsl(40,70%,95%)] text-[hsl(40,80%,40%)] shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── SCHEDULED TRAINING SESSIONS SECTION ── */}
        <Card className="border-t-2 border-t-[hsl(40,80%,50%)] shadow-sm overflow-hidden">
          <CardHeader className="bg-gray-50/80 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-5">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-[hsl(213,56%,24%)]" />
                Training Sessions &amp; Meetings
              </CardTitle>
              <CardDescription className="mt-1">
                Sessions scheduled for UDISE <strong className="text-gray-800 font-mono">{teacher.schoolUdise}</strong> • {teacher.school.name}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-bold">
                {selectedMeetingType === "HM" ? "HM Meetings" : "NMMS Online Classes"}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* ── Switcher Layer at top of table ── */}
            <div className="bg-gray-50/90 border-b border-gray-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-1">
                  Category:
                </span>
                <div className="inline-flex rounded-lg p-1 bg-gray-200/80 gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedMeetingType("NMMS")}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedMeetingType === "NMMS"
                        ? "bg-[hsl(213,56%,24%)] text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    NMMS Online Class
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMeetingType("HM")}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedMeetingType === "HM"
                        ? "bg-[hsl(213,56%,24%)] text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900 hover:bg-white/60"
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    HM Meeting
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsMeetingTypeModalOpen(true)}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline underline-offset-2 transition-colors flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Choose Category
                </button>
                <Badge variant="outline" className="text-xs bg-white text-gray-700">
                  UDISE: {teacher.schoolUdise}
                </Badge>
              </div>
            </div>

            {/* Notice banner for the selected meeting */}
            <div className="px-4 py-2.5 bg-blue-50/50 border-b border-blue-100/80 flex items-center justify-between text-xs text-blue-900">
              <span className="font-medium">
                Showing scheduled <strong>{selectedMeetingType === "HM" ? "HM Meetings (Head Master)" : "NMMS Online Classes"}</strong> for UDISE <strong>{teacher.schoolUdise}</strong>
              </span>
            </div>

            {activeSessionsList.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                  <Calendar className="w-6 h-6" />
                </div>
                <p className="text-base font-semibold text-gray-900">
                  No scheduled {selectedMeetingType === "HM" ? "HM Meetings" : "NMMS Online Classes"}
                </p>
                <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  There are currently no {selectedMeetingType === "HM" ? "Head Master meetings" : "NMMS online classes"} scheduled for UDISE {teacher.schoolUdise}.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMeetingType(selectedMeetingType === "HM" ? "NMMS" : "HM")}
                  className="mt-4 text-xs font-semibold"
                >
                  View {selectedMeetingType === "HM" ? "NMMS Online Classes" : "HM Meetings"} instead
                </Button>
              </div>
            ) : (
              <>
                {/* ── Mobile: card list, Join button always visible ── */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {activeSessionsList.map((sessionItem) => {
                    const isPresent = sessionItem.userAttendance?.status === "present";
                    const formattedTime = formatSessionTimeString(sessionItem.startTime, sessionItem.endTime);
                    const expired = isSessionExpired(sessionItem.sessionDate, sessionItem.endTime, sessionItem.startTime);

                    return (
                      <div
                        key={sessionItem.id}
                        className={`px-4 py-4 space-y-3 ${isPresent ? "bg-emerald-50/40" : ""}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-semibold text-gray-900 text-sm leading-snug">{sessionItem.title}</p>
                              {sessionItem.sessionType === "HM" ? (
                                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold py-0 h-4">HM Meet</Badge>
                              ) : (
                                <Badge variant="outline" className="bg-[hsl(213,45%,94%)] text-[hsl(213,56%,30%)] border-[hsl(213,45%,85%)] text-[10px] font-bold py-0 h-4">NMMS Online Class</Badge>
                              )}
                            </div>
                            {sessionItem.description && (
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{sessionItem.description}</p>
                            )}
                          </div>
                          <div className="shrink-0">
                            {isPresent ? (
                              <Badge variant="success" className="gap-1 text-xs">
                                <CheckCircle2 className="w-3 h-3" /> Present
                              </Badge>
                            ) : expired ? (
                              <Badge variant="destructive" className="gap-1 text-xs">
                                <XCircle className="w-3 h-3" /> Absent
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="gap-1 text-xs">
                                <Clock className="w-3 h-3" /> Pending
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(sessionItem.sessionDate).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </span>
                          {formattedTime && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formattedTime}
                            </span>
                          )}
                        </div>

                        {expired ? (
                          <p className="text-xs text-gray-400 font-medium flex items-center gap-1.5">
                            <XCircle className="w-3.5 h-3.5" /> Session closed
                          </p>
                        ) : isPresent ? (
                          <div className="flex flex-col gap-1.5">
                            <Button
                              onClick={() => handleJoinAndMark(sessionItem.id, sessionItem.generalMeetUrl, expired, true)}
                              variant="outline"
                              className="w-full h-10 gap-2 font-bold text-sm border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                              disabled={isPending}
                            >
                              <Video className="w-4 h-4 text-emerald-700" />
                              Rejoin Meeting
                            </Button>
                            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Attendance recorded
                            </p>
                          </div>
                        ) : (
                          <Button
                            onClick={() => handleJoinAndMark(sessionItem.id, sessionItem.generalMeetUrl, expired, false)}
                            className="w-full h-10 gap-2 font-bold text-sm"
                            disabled={isPending}
                          >
                            <Video className="w-4 h-4" />
                            Join & Mark Present
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop: table layout ── */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Session Details</TableHead>
                        <TableHead>Schedule</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Join Meeting</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeSessionsList.map((sessionItem) => {
                        const isPresent = sessionItem.userAttendance?.status === "present";
                        const formattedTime = formatSessionTimeString(sessionItem.startTime, sessionItem.endTime);
                        const expired = isSessionExpired(sessionItem.sessionDate, sessionItem.endTime, sessionItem.startTime);

                        return (
                          <TableRow key={sessionItem.id} className={isPresent ? "bg-emerald-50/30" : ""}>
                            <TableCell className="max-w-[280px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-bold text-gray-900">{sessionItem.title}</div>
                                {sessionItem.sessionType === "HM" ? (
                                  <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold py-0 h-4">HM Meet</Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-[hsl(213,45%,94%)] text-[hsl(213,56%,30%)] border-[hsl(213,45%,85%)] text-[10px] font-bold py-0 h-4">NMMS Online Class</Badge>
                                )}
                              </div>
                              {sessionItem.description && (
                                <div className="text-sm text-gray-500 mt-0.5 line-clamp-1">{sessionItem.description}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900 text-sm">
                                {new Date(sessionItem.sessionDate).toLocaleDateString("en-IN", {
                                  day: "2-digit", month: "short", year: "numeric",
                                })}
                              </div>
                              {formattedTime && (
                                <div className="text-xs font-medium text-gray-500 flex items-center gap-1 mt-1">
                                  <Clock className="w-3.5 h-3.5" /> {formattedTime}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {isPresent ? (
                                <Badge variant="success" className="gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Present
                                </Badge>
                              ) : expired ? (
                                <Badge variant="destructive" className="gap-1.5">
                                  <XCircle className="w-3.5 h-3.5" /> Absent
                                </Badge>
                              ) : (
                                <Badge variant="warning" className="gap-1.5">
                                  <Clock className="w-3.5 h-3.5" /> Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {expired ? (
                                <Badge variant="outline" className="text-gray-500 px-3 py-1.5">
                                  Closed
                                </Badge>
                              ) : isPresent ? (
                                <Button
                                  onClick={() => handleJoinAndMark(sessionItem.id, sessionItem.generalMeetUrl, expired, true)}
                                  variant="outline"
                                  className="h-9 gap-2 font-bold shadow-sm text-sm border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
                                  disabled={isPending}
                                >
                                  <Video className="w-4 h-4 text-emerald-700" />
                                  Rejoin Meeting
                                </Button>
                              ) : (
                                <Button
                                  onClick={() => handleJoinAndMark(sessionItem.id, sessionItem.generalMeetUrl, expired, false)}
                                  className="h-9 gap-2 font-bold shadow-sm text-sm"
                                  disabled={isPending}
                                >
                                  <Video className="w-4 h-4" />
                                  Join & Mark Present
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance History */}
        <Card>
          <CardHeader className="bg-gray-50/80 border-b border-gray-200 py-5">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="w-5 h-5 text-gray-500" /> Attendance History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {combinedHistory.length === 0 ? (
              <div className="py-8 px-4 text-center text-sm text-gray-500">
                No attendance records found.
              </div>
            ) : (
              <>
                {/* Mobile history list */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {combinedHistory.map((a) => (
                    <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{a.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(a.sessionDate).toLocaleDateString("en-IN", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                          {a.markedAt && (
                            <span className="ml-2 font-mono">
                              · {new Date(a.markedAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
                              })}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {a.status === "present" ? (
                          <Badge variant="success">Present</Badge>
                        ) : (
                          <Badge variant="destructive">Absent</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
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
                          <TableCell className="font-semibold text-gray-900">{a.title}</TableCell>
                          <TableCell className="font-medium text-gray-700">
                            {new Date(a.sessionDate).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-gray-600">
                            {a.markedAt
                              ? new Date(a.markedAt).toLocaleTimeString("en-IN", {
                                  hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
                                })
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {a.status === "present" ? (
                              <Badge variant="success">Present</Badge>
                            ) : (
                              <Badge variant="destructive">Absent</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
