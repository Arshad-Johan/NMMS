"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import { markMyBrteAttendanceAction } from "@/app/actions/brte";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  LogOut,
  Calendar,
  CheckCircle2,
  XCircle,
  BarChart3,
  Video,
  Clock,
  MapPin,
  History,
  Landmark,
  BookOpen,
} from "lucide-react";

interface BrteDashboardClientProps {
  brte: {
    id: string;
    emis: string;
    name: string;
    block: string | null;
    isActive: boolean;
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
  } catch {
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
    return new Date().getTime() > sessionEndTime.getTime();
  } catch {
    return false;
  }
}

export default function BrteDashboardClient({
  brte,
  assignedSessions: initialAssignedSessions,
  recentAttendance,
}: BrteDashboardClientProps) {
  const router = useRouter();
  const [assignedSessions, setAssignedSessions] = useState(initialAssignedSessions);
  const [isPending, startTransition] = useTransition();

  const initials = brte.name
    ? brte.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "BR";

  // Dynamic stats
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
    totalEvaluatedSessions > 0 ? Math.round((presentCount / totalEvaluatedSessions) * 100) : null;

  function handleJoinAndMark(sessionId: string, generalMeetUrl: string, isExpired: boolean) {
    if (isExpired) {
      toast.error("This session schedule has ended and is expired.");
      return;
    }

    // Open Google Meet link in new tab immediately
    window.open(generalMeetUrl, "_blank", "noopener,noreferrer");

    // Mark attendance as present on server
    startTransition(async () => {
      const res = await markMyBrteAttendanceAction(sessionId);
      if (res.error) {
        toast.error(`Could not record attendance: ${res.error}`);
      } else {
        toast.success("Attendance marked as Present!");
        setAssignedSessions(
          assignedSessions.map((s) =>
            s.id === sessionId
              ? { ...s, userAttendance: { status: "present", markedAt: new Date().toISOString() } }
              : s
          )
        );
        router.refresh();
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* ── Header Navbar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded bg-[hsl(213,56%,24%)] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="font-extrabold text-base tracking-tight text-gray-900 block leading-tight truncate">
                CEO - Madurai
              </span>
              <span className="text-xs font-bold text-black uppercase tracking-wider block truncate">
                Gmeet Attendance Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-gray-900 leading-tight">{brte.name}</div>
                <div className="text-xs text-gray-500 font-medium">EMIS: {brte.emis}</div>
              </div>
            </div>

            <form action={logoutAction}>
              <Button variant="outline" size="sm" type="submit" className="gap-2 text-xs h-9 text-gray-600 font-semibold">
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
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-black uppercase tracking-wide">
                <BookOpen className="w-4 h-4" />
                CEO - Madurai | Gmeet Attendance Portal
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                {brte.name}
              </h1>
              <div className="text-gray-600 font-medium flex flex-wrap items-center gap-x-3 gap-y-2 text-sm pt-1">
                <span className="font-mono text-gray-500">EMIS ID: {brte.emis}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2 md:pt-0">
              {brte.block && (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 w-fit">
                  <MapPin className="w-3 h-3 mr-1 text-emerald-500" />
                  {brte.block}
                </Badge>
              )}
              <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 w-fit">
                BRTE
              </Badge>
            </div>
          </div>
        </div>

        {/* Attendance Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Total Sessions
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalEvaluatedSessions}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Attended
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{presentCount}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Missed
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{missedCount}</p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-red-50 text-red-600 shrink-0">
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Rate
                </p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {attendanceRate !== null ? `${attendanceRate}%` : "—"}
                </p>
              </div>
              <div className="p-2 sm:p-3 rounded-lg bg-[hsl(213,56%,24%)]/10 text-[hsl(213,56%,24%)] shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── BRTE TRAINING SESSIONS SECTION ── */}
        <Card className="border-[hsl(213,56%,24%)]/20 shadow-md">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 flex flex-row items-center justify-between py-5">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-[hsl(213,56%,24%)]" />
                BRTE Training Sessions
              </CardTitle>
              <CardDescription className="mt-1">
                Sessions scheduled for your block.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-bold">
              {assignedSessions.length} Active
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            {assignedSessions.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mx-auto mb-3">
                  <Calendar className="w-6 h-6" />
                </div>
                <p className="text-base font-semibold text-gray-900">No scheduled sessions</p>
                <p className="text-sm text-gray-500 mt-1">Check back later for upcoming BRTE training sessions.</p>
              </div>
            ) : (
              <>
                {/* ── Mobile: card list, Join button always visible ── */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {assignedSessions.map((sessionItem) => {
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
                            <p className="font-semibold text-gray-900 text-sm leading-snug">{sessionItem.title}</p>
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
                              <Badge className="gap-1 text-xs bg-amber-100 text-amber-800 hover:bg-amber-100 border-transparent">
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
                          <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Attendance recorded
                          </p>
                        ) : (
                          <Button
                            onClick={() => handleJoinAndMark(sessionItem.id, sessionItem.generalMeetUrl, expired)}
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
                      {assignedSessions.map((sessionItem) => {
                        const isPresent = sessionItem.userAttendance?.status === "present";
                        const formattedTime = formatSessionTimeString(sessionItem.startTime, sessionItem.endTime);
                        const expired = isSessionExpired(sessionItem.sessionDate, sessionItem.endTime, sessionItem.startTime);

                        return (
                          <TableRow key={sessionItem.id} className={isPresent ? "bg-emerald-50/30" : ""}>
                            <TableCell className="max-w-[280px]">
                              <div className="font-bold text-gray-900">{sessionItem.title}</div>
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
                                <Badge variant="secondary" className="gap-1.5 bg-amber-100 text-amber-800 hover:bg-amber-100">
                                  <Clock className="w-3.5 h-3.5" /> Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {expired ? (
                                <Badge variant="outline" className="text-gray-500 px-3 py-1.5">
                                  Closed
                                </Badge>
                              ) : (
                                <Button
                                  onClick={() => handleJoinAndMark(sessionItem.id, sessionItem.generalMeetUrl, expired)}
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
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-5">
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
                          <TableCell className="font-medium text-gray-600">
                            {new Date(a.sessionDate).toLocaleDateString("en-IN", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="font-mono text-sm text-gray-500">
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
