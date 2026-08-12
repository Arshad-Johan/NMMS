"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import {
  createSessionAction,
  updateSessionAction,
  deleteSessionAction,
  createTeacherAction,
  updateTeacherAction,
  deleteTeacherAction,
  createSchoolAction,
  updateSchoolAction,
  deleteSchoolAction,
  markAttendanceAction,
  deleteAttendanceAction,
  exportAttendanceExcelAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Plus,
  Calendar,
  Users,
  School as SchoolIcon,
  BarChart3,
  Video,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  Shield,
  Layers,
  ClipboardList,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  UserPlus,
  Building2,
  FileSpreadsheet,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Landmark
} from "lucide-react";
import { CategoryType, SchoolType, AttendanceStatus } from "@prisma/client";

type Tab = "overview" | "sessions" | "new-session" | "teachers" | "schools";

interface AdminDashboardProps {
  adminName: string;
  stats: {
    totalSchools: number;
    totalTeachers: number;
    totalSessions: number;
    overallRate: number;
  };
  initialSessions: any[];
  initialTeachers: any[];
  initialSchools: any[];
  initialAttendance: any[];
}

const ITEMS_PER_PAGE = 15;

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

// ---------------------------------------------------------------------------
// SEARCHABLE SCHOOL COMBOBOX SELECT
// ---------------------------------------------------------------------------
function SearchableSchoolSelect({
  schools,
  value,
  onChange,
}: {
  schools: Array<{ udise: string; name: string }>;
  value: string;
  onChange: (udise: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedSchool = schools.find((s) => s.udise === value);

  const filtered = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.udise.includes(search)
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 rounded-md bg-white border border-gray-300 px-3 text-left text-gray-900 text-sm flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[hsl(213,56%,24%)]"
      >
        <span className="truncate">
          {selectedSchool
            ? `${selectedSchool.udise} - ${selectedSchool.name}`
            : "-- Type or Select Participating School --"}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-11 z-50 rounded-md bg-white border border-gray-200 shadow-lg p-2 space-y-2 max-h-60 overflow-y-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search by character, school name, or UDISE..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:border-[hsl(213,56%,24%)]"
            />
          </div>

          <div className="space-y-1">
            {filtered.length === 0 ? (
              <div className="p-2 text-center text-gray-500 text-sm">
                No matching school found.
              </div>
            ) : (
              filtered.map((sc) => (
                <button
                  key={sc.udise}
                  type="button"
                  onClick={() => {
                    onChange(sc.udise);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-left p-2 rounded text-sm transition-colors flex items-center justify-between ${
                    sc.udise === value
                      ? "bg-blue-50 text-[hsl(213,56%,24%)] font-semibold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">
                    <strong className="text-gray-900">{sc.udise}</strong> - {sc.name}
                  </span>
                  {sc.udise === value && <Check className="w-4 h-4 text-[hsl(213,56%,24%)] shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardClient({
  adminName,
  stats,
  initialSessions,
  initialTeachers,
  initialSchools,
  initialAttendance,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sessions, setSessions] = useState(initialSessions);
  const [teachers, setTeachers] = useState(initialTeachers);
  const [schools, setSchools] = useState(initialSchools);

  const [teacherSearch, setTeacherSearch] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  // Pagination States
  const [teacherPage, setTeacherPage] = useState(1);
  const [schoolPage, setSchoolPage] = useState(1);

  // Modal States
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [isAddTeacherOpen, setIsAddTeacherOpen] = useState(false);
  const [newTeacherData, setNewTeacherData] = useState({
    name: "",
    mobile: "",
    schoolUdise: "",
    subject: "NMMS Incharge",
    isActive: true,
  });

  const [editingSchool, setEditingSchool] = useState<any | null>(null);
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [newSchoolData, setNewSchoolData] = useState({
    udise: "",
    name: "",
    educationDistrict: "Madurai",
    block: "",
    schoolType: "Government" as SchoolType,
    categoryType: null as CategoryType | null,
    class8Total: 0,
    willingStudents: 0,
  });

  const [editingSession, setEditingSession] = useState<any | null>(null);

  // New Session Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [generalMeetUrl, setGeneralMeetUrl] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<CategoryType[]>([]);

  // Filtered lists
  const filteredTeachers = teachers.filter(
    (t) =>
      t.name?.toLowerCase().includes(teacherSearch.toLowerCase()) ||
      t.mobile.includes(teacherSearch) ||
      t.schoolUdise.includes(teacherSearch)
  );

  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.udise.includes(schoolSearch) ||
      (s.block && s.block.toLowerCase().includes(schoolSearch.toLowerCase()))
  );

  // Pagination Calculations
  const totalTeacherPages = Math.max(1, Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE));
  const currentTeacherPage = Math.min(teacherPage, totalTeacherPages);
  const paginatedTeachers = filteredTeachers.slice(
    (currentTeacherPage - 1) * ITEMS_PER_PAGE,
    currentTeacherPage * ITEMS_PER_PAGE
  );

  const totalSchoolPages = Math.max(1, Math.ceil(filteredSchools.length / ITEMS_PER_PAGE));
  const currentSchoolPage = Math.min(schoolPage, totalSchoolPages);
  const paginatedSchools = filteredSchools.slice(
    (currentSchoolPage - 1) * ITEMS_PER_PAGE,
    currentSchoolPage * ITEMS_PER_PAGE
  );

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSessionAction({
        title,
        description,
        sessionDate,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        generalMeetUrl,
        categoryTypes: selectedCategories,
      });

      if (res.error) {
        toast.error(`Failed to create session: ${res.error}`);
      } else {
        toast.success("Training Session created successfully!");
        if (res.createdSession) {
          setSessions((prev) => [res.createdSession, ...prev]);
        }
        setTitle("");
        setDescription("");
        setSessionDate("");
        setStartTime("");
        setEndTime("");
        setGeneralMeetUrl("");
        setSelectedCategories([]);
        setActiveTab("sessions");
        router.refresh();
      }
    });
  }

  function handleUpdateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSession) return;

    startTransition(async () => {
      const res = await updateSessionAction(editingSession.id, {
        title: editingSession.title,
        generalMeetUrl: editingSession.generalMeetUrl,
        isAttendanceOpen: editingSession.isAttendanceOpen,
        isPublished: editingSession.isPublished,
      });
      if (res.error) {
        toast.error(`Update failed: ${res.error}`);
      } else {
        toast.success("Session updated successfully!");
        setSessions(sessions.map((s) => (s.id === editingSession.id ? editingSession : s)));
        setEditingSession(null);
        router.refresh();
      }
    });
  }

  function handleDeleteSession(id: string) {
    if (!confirm("Are you sure you want to delete this session?")) return;
    startTransition(async () => {
      const res = await deleteSessionAction(id);
      if (res.error) {
        toast.error(`Delete failed: ${res.error}`);
      } else {
        toast.success("Session deleted successfully!");
        setSessions(sessions.filter((s) => s.id !== id));
        router.refresh();
      }
    });
  }

  function handleAddTeacher(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createTeacherAction(newTeacherData);
      if (res.error) {
        toast.error(`Failed to add teacher: ${res.error}`);
      } else {
        toast.success("Teacher registered successfully!");
        setIsAddTeacherOpen(false);
        setNewTeacherData({ name: "", mobile: "", schoolUdise: "", subject: "NMMS Incharge", isActive: true });
        router.refresh();
      }
    });
  }

  function handleUpdateTeacher(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTeacher) return;

    startTransition(async () => {
      const res = await updateTeacherAction(editingTeacher.id, {
        name: editingTeacher.name,
        mobile: editingTeacher.mobile,
        schoolUdise: editingTeacher.schoolUdise,
        subject: editingTeacher.subject,
        isActive: editingTeacher.isActive,
      });
      if (res.error) {
        toast.error(`Update failed: ${res.error}`);
      } else {
        toast.success("Teacher updated successfully!");
        setTeachers(teachers.map((t) => (t.id === editingTeacher.id ? { ...t, ...editingTeacher } : t)));
        setEditingTeacher(null);
        router.refresh();
      }
    });
  }

  function handleDeleteTeacher(id: string) {
    if (!confirm("Delete this teacher record?")) return;
    startTransition(async () => {
      const res = await deleteTeacherAction(id);
      if (res.error) {
        toast.error(`Delete failed: ${res.error}`);
      } else {
        toast.success("Teacher deleted successfully!");
        setTeachers(teachers.filter((t) => t.id !== id));
        router.refresh();
      }
    });
  }

  function handleAddSchool(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSchoolAction(newSchoolData);
      if (res.error) {
        toast.error(`Failed to add school: ${res.error}`);
      } else {
        toast.success("School added successfully!");
        setIsAddSchoolOpen(false);
        setNewSchoolData({ udise: "", name: "", educationDistrict: "Madurai", block: "", schoolType: "Government", categoryType: null, class8Total: 0, willingStudents: 0 });
        router.refresh();
      }
    });
  }

  function handleUpdateSchool(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSchool) return;

    startTransition(async () => {
      const res = await updateSchoolAction(editingSchool.udise, {
        name: editingSchool.name,
        educationDistrict: editingSchool.educationDistrict,
        block: editingSchool.block,
        schoolType: editingSchool.schoolType,
        categoryType: editingSchool.categoryType,
        class8Boys: editingSchool.class8Boys,
        class8Girls: editingSchool.class8Girls,
        class8Total: editingSchool.class8Total,
        willingStudents: editingSchool.willingStudents,
        isActive: editingSchool.isActive,
      });
      if (res.error) {
        toast.error(`Update failed: ${res.error}`);
      } else {
        toast.success("School details updated successfully!");
        setSchools(schools.map((s) => (s.udise === editingSchool.udise ? { ...s, ...editingSchool } : s)));
        setEditingSchool(null);
        router.refresh();
      }
    });
  }

  function handleQuickCategoryChange(udise: string, categoryType: CategoryType | null) {
    startTransition(async () => {
      const res = await updateSchoolAction(udise, { categoryType });
      if (res.error) {
        toast.error(`Failed to update category: ${res.error}`);
      } else {
        const catLabel = categoryType ? categoryType.replace("_", " ") : "None";
        toast.success(`School category updated to ${catLabel}`);
        setSchools(schools.map((s) => (s.udise === udise ? { ...s, categoryType } : s)));
        router.refresh();
      }
    });
  }

  function handleDeleteSchool(udise: string) {
    if (!confirm("Delete this school record?")) return;
    startTransition(async () => {
      const res = await deleteSchoolAction(udise);
      if (res.error) {
        toast.error(`Delete failed: ${res.error}`);
      } else {
        toast.success("School record deleted successfully!");
        setSchools(schools.filter((s) => s.udise !== udise));
        router.refresh();
      }
    });
  }

  function handleExportSessionExcel(sessionId: string, title: string, status: "present" | "absent") {
    startTransition(async () => {
      const res = await exportAttendanceExcelAction(sessionId, status);
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Downloaded ${status.toUpperCase()} Teachers Excel for "${title}" (${res.count} records)!`);
      }
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* ── Header Navbar ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded bg-[hsl(213,56%,24%)] flex items-center justify-center text-white shrink-0 shadow-sm">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="font-bold text-base tracking-tight text-gray-900 block leading-tight truncate">
                NMMS Admin Portal
              </span>
              <span className="text-xs font-medium tracking-wide text-gray-500 uppercase truncate block">
                Govt. of Tamil Nadu
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9">
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-gray-900 leading-tight">
                  {adminName}
                </div>
                <div className="text-xs text-gray-500 font-medium">Administrator</div>
              </div>
            </div>

            <form action={logoutAction}>
              <Button
                variant="outline"
                size="sm"
                type="submit"
                className="gap-2 text-xs h-9 text-gray-600 font-semibold"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Responsive Navigation Tabs ── */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-2 overflow-x-auto py-2.5">
          {[
            { id: "overview", label: "Dashboard", icon: Layers },
            { id: "sessions", label: "Sessions", icon: Video },
            { id: "new-session", label: "New Session", icon: Plus },
            { id: "teachers", label: "Teachers", icon: Users },
            { id: "schools", label: "Schools", icon: SchoolIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-blue-50 text-[hsl(213,56%,24%)]"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[hsl(213,56%,24%)]" : "text-gray-400"}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Workspace Content ── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ── TAB 1: OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-fade-up">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Card className="col-span-2 lg:col-span-1">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">Total Schools</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{schools.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <SchoolIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">Teachers</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{teachers.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                    <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">Sessions</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{sessions.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-[hsl(213,56%,24%)]/10 text-[hsl(213,56%,24%)] shrink-0">
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <h2 className="text-lg font-bold text-gray-900">Recent Sessions Overview</h2>
              <Button onClick={() => setActiveTab("new-session")} className="w-full sm:w-auto gap-2">
                <Plus className="w-4 h-4" /> Schedule Session
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Google Meet Link</TableHead>
                        <TableHead>Target Categories</TableHead>
                        <TableHead>Exports</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((s) => {
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-semibold text-gray-900">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px]">{s.title}</span>
                                {expired && <Badge variant="secondary" className="text-[10px]">Ended</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">
                                {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </div>
                              {formattedTime && (
                                <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" /> {formattedTime}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {expired ? (
                                <span className="text-xs text-gray-500 font-medium">Link closed</span>
                              ) : (
                                <a
                                  href={s.generalMeetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                                >
                                  Open Meet <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </TableCell>
                            <TableCell>
                              {s.categoryRules?.length === 0 ? (
                                <Badge variant="secondary">All Schools</Badge>
                              ) : (
                                <div className="flex gap-1 flex-wrap">
                                  {s.categoryRules?.map((r: any) => (
                                    <Badge key={r.id} variant="outline" className="bg-white">{r.categoryType.replace("_", " ")}</Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleExportSessionExcel(s.id, s.title, "present")}
                                  disabled={isPending}
                                  className="h-8 text-xs font-semibold"
                                >
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleExportSessionExcel(s.id, s.title, "absent")}
                                  disabled={isPending}
                                  className="h-8 text-xs font-semibold"
                                >
                                  Absent
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => setEditingSession({ ...s })} className="h-8 w-8 text-gray-500">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 2: SESSIONS LIST ── */}
        {activeTab === "sessions" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Training Sessions</h2>
                <p className="text-sm text-gray-500">Manage all scheduled sessions and export attendance.</p>
              </div>
              <Button onClick={() => setActiveTab("new-session")} className="w-full sm:w-auto gap-2">
                <Plus className="w-4 h-4" /> Schedule New Session
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Google Meet Link</TableHead>
                        <TableHead>Exports</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((s) => {
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-semibold text-gray-900">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px]">{s.title}</span>
                                {expired && <Badge variant="secondary" className="text-[10px]">Ended</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">
                                {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </div>
                              {formattedTime && (
                                <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" /> {formattedTime}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {expired ? (
                                <span className="text-xs text-gray-500 font-medium">Link closed</span>
                              ) : (
                                <a
                                  href={s.generalMeetUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                                >
                                  Open Meet <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleExportSessionExcel(s.id, s.title, "present")}
                                  disabled={isPending}
                                  className="h-8 text-xs font-semibold"
                                >
                                  <Download className="w-3 h-3 mr-1" /> Present
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleExportSessionExcel(s.id, s.title, "absent")}
                                  disabled={isPending}
                                  className="h-8 text-xs font-semibold"
                                >
                                  <Download className="w-3 h-3 mr-1" /> Absent
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => setEditingSession({ ...s })} className="h-8 w-8 text-gray-500">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 3: CREATE NEW SESSION ── */}
        {activeTab === "new-session" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
            <Card>
              <CardHeader className="border-b border-gray-100 bg-gray-50/50">
                <CardTitle>Schedule Session</CardTitle>
                <CardDescription>
                  Create a new training schedule and specify target school categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateSession} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Session Title <span className="text-red-500">*</span></label>
                    <Input placeholder="e.g. NMMS Orientation Session 1" value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Description</label>
                    <Input placeholder="Brief agenda or instructions" value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-sm font-semibold text-gray-700">Date <span className="text-red-500">*</span></label>
                      <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Start Time</label>
                      <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">End Time</label>
                      <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Google Meet URL <span className="text-red-500">*</span></label>
                    <Input placeholder="https://meet.google.com/abc-defg-hij" value={generalMeetUrl} onChange={(e) => setGeneralMeetUrl(e.target.value)} required />
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-100">
                    <label className="text-sm font-semibold text-gray-700">Target School Categories</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { id: "High_School", label: "High School" },
                        { id: "Higher_Secondary_School", label: "Higher Secondary School" },
                      ].map((cat) => {
                        const isSelected = selectedCategories.includes(cat.id as CategoryType);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedCategories(selectedCategories.filter((c) => c !== cat.id));
                              } else {
                                setSelectedCategories([...selectedCategories, cat.id as CategoryType]);
                              }
                            }}
                            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                              isSelected
                                ? "bg-blue-50 border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)]"
                                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-[hsl(213,56%,24%)] bg-[hsl(213,56%,24%)] text-white" : "border-gray-300 bg-white"}`}>
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div className="text-sm font-semibold">{cat.label}</div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 pt-1">
                      {selectedCategories.length === 0
                        ? "No filters selected. Session visible to ALL active teachers."
                        : `Session visible ONLY to teachers in selected categories.`}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? "Creating..." : "Save Session"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 4: TEACHERS DIRECTORY ── */}
        {activeTab === "teachers" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Teachers Directory</h2>
                <p className="text-sm text-gray-500">Manage registered teachers ({filteredTeachers.length} total).</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <Input
                    placeholder="Search by name, mobile, UDISE..."
                    value={teacherSearch}
                    onChange={(e) => {
                      setTeacherSearch(e.target.value);
                      setTeacherPage(1);
                    }}
                    className="pl-9 h-9"
                  />
                </div>
                <Button onClick={() => setIsAddTeacherOpen(true)} className="gap-2 h-9">
                  <UserPlus className="w-4 h-4" /> Add Teacher
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Mobile</TableHead>
                        <TableHead>School UDISE</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTeachers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No teachers match your search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTeachers.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-semibold text-gray-900">{t.name ?? "Unassigned"}</TableCell>
                            <TableCell className="font-mono text-sm text-gray-600">+91 {t.mobile}</TableCell>
                            <TableCell className="font-mono text-sm text-gray-600">{t.schoolUdise}</TableCell>
                            <TableCell className="text-gray-600">{t.subject ?? "NMMS Incharge"}</TableCell>
                            <TableCell>
                              <Badge variant={t.isActive ? "success" : "secondary"}>
                                {t.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => setEditingTeacher({ ...t })} className="h-8 w-8 text-gray-500">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteTeacher(t.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-200 bg-gray-50/50">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-bold text-gray-900">{filteredTeachers.length === 0 ? 0 : (currentTeacherPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentTeacherPage * ITEMS_PER_PAGE, filteredTeachers.length)}</span> of <span className="font-bold text-gray-900">{filteredTeachers.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentTeacherPage <= 1}
                      onClick={() => setTeacherPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                    </Button>
                    <span className="text-sm font-medium text-gray-600 px-2">
                      Page {currentTeacherPage} of {totalTeacherPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentTeacherPage >= totalTeacherPages}
                      onClick={() => setTeacherPage((p) => p + 1)}
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 5: SCHOOLS DIRECTORY ── */}
        {activeTab === "schools" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Schools Directory</h2>
                <p className="text-sm text-gray-500">Participating institutions ({filteredSchools.length} total).</p>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <Input
                    placeholder="Search UDISE, school, block..."
                    value={schoolSearch}
                    onChange={(e) => {
                      setSchoolSearch(e.target.value);
                      setSchoolPage(1);
                    }}
                    className="pl-9 h-9"
                  />
                </div>
                <Button onClick={() => setIsAddSchoolOpen(true)} className="gap-2 h-9">
                  <Building2 className="w-4 h-4" /> Add School
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>UDISE Code</TableHead>
                        <TableHead>School Name</TableHead>
                        <TableHead>Block / District</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSchools.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                            No schools match your search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedSchools.map((sc) => (
                          <TableRow key={sc.udise}>
                            <TableCell className="font-mono font-bold text-[hsl(213,56%,24%)]">{sc.udise}</TableCell>
                            <TableCell className="font-semibold text-gray-900 max-w-sm truncate">{sc.name}</TableCell>
                            <TableCell className="text-gray-600">{sc.block ?? "—"} / {sc.educationDistrict ?? "—"}</TableCell>
                            <TableCell>
                              <select
                                value={sc.categoryType ?? ""}
                                onChange={(e) =>
                                  handleQuickCategoryChange(
                                    sc.udise,
                                    e.target.value ? (e.target.value as CategoryType) : null
                                  )
                                }
                                className="h-8 rounded-md bg-white border border-gray-300 text-sm px-2 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[hsl(213,56%,24%)]"
                              >
                                <option value="">Unspecified</option>
                                <option value="High_School">High School</option>
                                <option value="Higher_Secondary_School">Higher Secondary School</option>
                              </select>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => setEditingSchool({ ...sc })} className="h-8 w-8 text-gray-500">
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteSchool(sc.udise)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-200 bg-gray-50/50">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-bold text-gray-900">{filteredSchools.length === 0 ? 0 : (currentSchoolPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentSchoolPage * ITEMS_PER_PAGE, filteredSchools.length)}</span> of <span className="font-bold text-gray-900">{filteredSchools.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentSchoolPage <= 1}
                      onClick={() => setSchoolPage((p) => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                    </Button>
                    <span className="text-sm font-medium text-gray-600 px-2">
                      Page {currentSchoolPage} of {totalSchoolPages}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentSchoolPage >= totalSchoolPages}
                      onClick={() => setSchoolPage((p) => p + 1)}
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* --------------------------------------------------------------------------- */}
      {/* MODALS & DIALOGS */}
      {/* --------------------------------------------------------------------------- */}

      {/* ADD TEACHER MODAL */}
      {isAddTeacherOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Register Teacher</CardTitle>
              <button onClick={() => setIsAddTeacherOpen(false)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddTeacher} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Teacher Name <span className="text-red-500">*</span></label>
                  <Input required placeholder="e.g. K. Arulmozhi" value={newTeacherData.name} onChange={(e) => setNewTeacherData({ ...newTeacherData, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Mobile Number <span className="text-red-500">*</span></label>
                  <Input required maxLength={10} placeholder="10-digit number" value={newTeacherData.mobile} onChange={(e) => setNewTeacherData({ ...newTeacherData, mobile: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">School / UDISE Code <span className="text-red-500">*</span></label>
                  {schools.length > 0 ? (
                    <SearchableSchoolSelect schools={schools} value={newTeacherData.schoolUdise} onChange={(udise) => setNewTeacherData({ ...newTeacherData, schoolUdise: udise })} />
                  ) : (
                    <Input required placeholder="UDISE code" value={newTeacherData.schoolUdise} onChange={(e) => setNewTeacherData({ ...newTeacherData, schoolUdise: e.target.value })} />
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Role / Subject</label>
                  <Input placeholder="NMMS Incharge" value={newTeacherData.subject} onChange={(e) => setNewTeacherData({ ...newTeacherData, subject: e.target.value })} />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={isPending || !newTeacherData.schoolUdise}>
                  {isPending ? "Saving..." : "Register Teacher"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT TEACHER MODAL */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Edit Teacher</CardTitle>
              <button onClick={() => setEditingTeacher(null)} className="text-gray-400 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleUpdateTeacher} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Teacher Name</label>
                  <Input value={editingTeacher.name ?? ""} onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Mobile Number</label>
                  <Input value={editingTeacher.mobile ?? ""} onChange={(e) => setEditingTeacher({ ...editingTeacher, mobile: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">School / UDISE Code</label>
                  <SearchableSchoolSelect schools={schools} value={editingTeacher.schoolUdise ?? ""} onChange={(udise) => setEditingTeacher({ ...editingTeacher, schoolUdise: udise })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Role / Subject</label>
                  <Input value={editingTeacher.subject ?? ""} onChange={(e) => setEditingTeacher({ ...editingTeacher, subject: e.target.value })} />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={isPending}>Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ADD SCHOOL MODAL */}
      {isAddSchoolOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Add School</CardTitle>
              <button onClick={() => setIsAddSchoolOpen(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddSchool} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">UDISE Code <span className="text-red-500">*</span></label>
                  <Input required placeholder="33240..." value={newSchoolData.udise} onChange={(e) => setNewSchoolData({ ...newSchoolData, udise: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">School Name <span className="text-red-500">*</span></label>
                  <Input required placeholder="Govt Higher Secondary School..." value={newSchoolData.name} onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">Block</label>
                    <Input placeholder="Melur" value={newSchoolData.block} onChange={(e) => setNewSchoolData({ ...newSchoolData, block: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">District</label>
                    <Input placeholder="Madurai" value={newSchoolData.educationDistrict} onChange={(e) => setNewSchoolData({ ...newSchoolData, educationDistrict: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Category Type</label>
                  <select
                    value={newSchoolData.categoryType ?? ""}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, categoryType: e.target.value ? (e.target.value as CategoryType) : null })}
                    className="w-full h-10 rounded-md bg-white border border-gray-300 px-3 text-gray-900 focus:ring-2 focus:ring-[hsl(213,56%,24%)] focus:outline-none"
                  >
                    <option value="">Unspecified</option>
                    <option value="High_School">High School</option>
                    <option value="Higher_Secondary_School">Higher Secondary School</option>
                  </select>
                </div>
                <Button type="submit" className="w-full mt-2" disabled={isPending}>Save School</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT SCHOOL MODAL */}
      {editingSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Edit School</CardTitle>
              <button onClick={() => setEditingSchool(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleUpdateSchool} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">School Name</label>
                  <Input value={editingSchool.name ?? ""} onChange={(e) => setEditingSchool({ ...editingSchool, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">Block</label>
                    <Input value={editingSchool.block ?? ""} onChange={(e) => setEditingSchool({ ...editingSchool, block: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">District</label>
                    <Input value={editingSchool.educationDistrict ?? ""} onChange={(e) => setEditingSchool({ ...editingSchool, educationDistrict: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Category Type</label>
                  <select
                    value={editingSchool.categoryType ?? ""}
                    onChange={(e) => setEditingSchool({ ...editingSchool, categoryType: e.target.value ? (e.target.value as CategoryType) : null })}
                    className="w-full h-10 rounded-md bg-white border border-gray-300 px-3 text-gray-900 focus:ring-2 focus:ring-[hsl(213,56%,24%)] focus:outline-none"
                  >
                    <option value="">Unspecified</option>
                    <option value="High_School">High School</option>
                    <option value="Higher_Secondary_School">Higher Secondary School</option>
                  </select>
                </div>
                <Button type="submit" className="w-full mt-2" disabled={isPending}>Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT SESSION MODAL */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl border-0">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4">
              <CardTitle className="text-lg">Edit Session</CardTitle>
              <button onClick={() => setEditingSession(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleUpdateSession} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Session Title</label>
                  <Input value={editingSession.title ?? ""} onChange={(e) => setEditingSession({ ...editingSession, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Google Meet URL</label>
                  <Input value={editingSession.generalMeetUrl ?? ""} onChange={(e) => setEditingSession({ ...editingSession, generalMeetUrl: e.target.value })} />
                </div>
                <Button type="submit" className="w-full mt-2" disabled={isPending}>Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
