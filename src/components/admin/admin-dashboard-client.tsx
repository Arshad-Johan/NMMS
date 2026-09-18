"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { logoutAction } from "@/app/actions/auth";
import {
  createSessionAction,
  updateSessionAction,
  deleteSessionAction,
  createSchoolAction,
  updateSchoolAction,
  deleteSchoolAction,
  markAttendanceAction,
  deleteAttendanceAction,
  exportAttendanceExcelAction,
  exportConsolidatedAttendanceExcelAction,
  exportConsolidatedBrteAttendanceExcelAction,
  createBrteSessionAction,
  updateBrteSessionAction,
  deleteBrteSessionAction,
  exportBrteAttendanceExcelAction,
} from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus,
  School as SchoolIcon,
  Video,
  Search,
  RefreshCw,
  Check,
  Layers,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Building2,
  Download,
  ChevronLeft,
  ChevronRight,
  Clock,
  Landmark,
  BookOpen,
} from "lucide-react";
import { CategoryType } from "@prisma/client";

type Tab = "overview" | "sessions" | "new-session" | "brte-sessions" | "new-brte-session" | "schools";

interface AdminDashboardProps {
  adminName: string;
  availableSchoolTypes?: string[];
  availableBlocks?: string[];
  availableBrteBlocks?: string[];
  stats: {
    totalSchools: number;
    totalSessions: number;
    totalBrteSessions?: number;
    overallRate: number;
  };
  initialSessions: any[];
  initialBrteSessions?: any[];
  initialSchools: any[];
  initialAttendance: any[];
}

const ITEMS_PER_PAGE = 15;

const CATEGORY_TYPE_OPTIONS: { id: CategoryType; label: string }[] = [
  { id: "Primary_School", label: "Primary School" },
  { id: "Middle_School", label: "Middle School" },
  { id: "High_School", label: "High School" },
  { id: "Higher_Secondary_School", label: "Higher Secondary School" },
  { id: "Pre_Primary_School", label: "Pre-Primary School" },
];

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

function formatDateForInput(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatTimeForInput(timeStr?: string | null): string {
  if (!timeStr) return "";
  try {
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return "";
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "";
  }
}

function isSessionExpired(sessionDateStr: string, endTimeStr?: string | null, startTimeStr?: string | null): boolean {
  if (!sessionDateStr) return false;
  try {
    const sDate = new Date(sessionDateStr);
    const year = sDate.getFullYear();
    const month = sDate.getMonth();
    const day = sDate.getDate();

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
  } catch {
    return false;
  }
}

export default function AdminDashboardClient({
  adminName,
  availableSchoolTypes = [],
  availableBlocks = [],
  availableBrteBlocks = [],
  stats,
  initialSessions,
  initialBrteSessions = [],
  initialSchools,
  initialAttendance,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [sessions, setSessions] = useState(initialSessions);
  const [brteSessions, setBrteSessions] = useState(initialBrteSessions);
  const [schools, setSchools] = useState(initialSchools);

  const [schoolSearch, setSchoolSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [exportingSessionId, setExportingSessionId] = useState<string | null>(null);
  const [exportingBrteSessionId, setExportingBrteSessionId] = useState<string | null>(null);
  const [isExportingConsolidated, setIsExportingConsolidated] = useState(false);
  const [isExportingConsolidatedBrte, setIsExportingConsolidatedBrte] = useState(false);
  const [isExportSchoolsMatrixOpen, setIsExportSchoolsMatrixOpen] = useState(false);
  const [exportFilterCategories, setExportFilterCategories] = useState<CategoryType[]>([]);
  const [exportFilterSchoolTypes, setExportFilterSchoolTypes] = useState<string[]>([]);
  const [exportFilterBlocks, setExportFilterBlocks] = useState<string[]>([]);

  // Pagination States
  const [schoolPage, setSchoolPage] = useState(1);

  // Modal States
  const [editingSchool, setEditingSchool] = useState<any | null>(null);
  const [isAddSchoolOpen, setIsAddSchoolOpen] = useState(false);
  const [newSchoolData, setNewSchoolData] = useState({
    udise: "",
    name: "",
    educationDistrict: "MADURAI",
    block: "",
    schoolType: "Government",
    management: "",
    category: "",
    categoryType: null as CategoryType | null,
  });

  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editingBrteSession, setEditingBrteSession] = useState<any | null>(null);

  // New Teacher Session Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [generalMeetUrl, setGeneralMeetUrl] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<CategoryType[]>([]);
  const [selectedSchoolTypes, setSelectedSchoolTypes] = useState<string[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);

  // New BRTE Session Form State
  const [brteTitle, setBrteTitle] = useState("");
  const [brteDescription, setBrteDescription] = useState("");
  const [brteSessionDate, setBrteSessionDate] = useState("");
  const [brteStartTime, setBrteStartTime] = useState("");
  const [brteEndTime, setBrteEndTime] = useState("");
  const [brteMeetUrl, setBrteMeetUrl] = useState("");
  const [selectedBrteBlocks, setSelectedBrteBlocks] = useState<string[]>([]);

  // Filtered lists
  const filteredSchools = schools.filter(
    (s) =>
      s.name?.toLowerCase().includes(schoolSearch.toLowerCase()) ||
      s.udise?.includes(schoolSearch) ||
      (s.block && s.block.toLowerCase().includes(schoolSearch.toLowerCase())) ||
      (s.management && s.management.toLowerCase().includes(schoolSearch.toLowerCase())) ||
      (s.educationDistrict && s.educationDistrict.toLowerCase().includes(schoolSearch.toLowerCase()))
  );

  // Pagination Calculations
  const totalSchoolPages = Math.max(1, Math.ceil(filteredSchools.length / ITEMS_PER_PAGE));
  const currentSchoolPage = Math.min(schoolPage, totalSchoolPages);
  const paginatedSchools = filteredSchools.slice(
    (currentSchoolPage - 1) * ITEMS_PER_PAGE,
    currentSchoolPage * ITEMS_PER_PAGE
  );

  // ---------------------------------------------------------------------------
  // TEACHER SESSION HANDLERS
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
        schoolTypes: selectedSchoolTypes,
        blocks: selectedBlocks,
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
        setSelectedSchoolTypes([]);
        setSelectedBlocks([]);
        setActiveTab("sessions");
        router.refresh();
      }
    });
  }

  function openEditSession(s: any) {
    setEditingSession({
      id: s.id,
      title: s.title ?? "",
      description: s.description ?? "",
      generalMeetUrl: s.generalMeetUrl ?? "",
      sessionDate: formatDateForInput(s.sessionDate),
      startTime: formatTimeForInput(s.startTime),
      endTime: formatTimeForInput(s.endTime),
      categoryTypes: s.categoryRules ? s.categoryRules.map((r: any) => r.categoryType) : [],
      schoolTypes: s.schoolTypeRules ? s.schoolTypeRules.map((r: any) => r.schoolType) : [],
      blocks: s.blockRules ? s.blockRules.map((r: any) => r.block) : [],
    });
  }

  function handleUpdateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSession) return;

    if (!editingSession.title?.trim()) {
      toast.error("Please enter a session title.");
      return;
    }
    if (!editingSession.generalMeetUrl?.trim()) {
      toast.error("Please enter a Google Meet URL.");
      return;
    }
    if (!editingSession.sessionDate) {
      toast.error("Please select a session date.");
      return;
    }

    startTransition(async () => {
      const res = await updateSessionAction(editingSession.id, {
        title: editingSession.title.trim(),
        description: editingSession.description?.trim() || undefined,
        generalMeetUrl: editingSession.generalMeetUrl.trim(),
        sessionDate: editingSession.sessionDate,
        startTime: editingSession.startTime || undefined,
        endTime: editingSession.endTime || undefined,
        categoryTypes: editingSession.categoryTypes || [],
        schoolTypes: editingSession.schoolTypes || [],
        blocks: editingSession.blocks || [],
      });
      if (res.error) {
        toast.error(`Update failed: ${res.error}`);
      } else {
        toast.success("Session updated successfully! Target schools will now receive the link.");
        if (res.updatedSession) {
          setSessions((prev) =>
            prev.map((s) => (s.id === editingSession.id ? res.updatedSession : s))
          );
        }
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

  function handleExportSessionExcel(sessionId: string, title: string) {
    setExportingSessionId(sessionId);
    startTransition(async () => {
      const res = await exportAttendanceExcelAction(sessionId);
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
        setExportingSessionId(null);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported attendance for "${title}" (${res.count} schools)!`);
        setExportingSessionId(null);
      }
    });
  }

  function handleExportConsolidatedAttendance() {
    setExportFilterCategories([]);
    setExportFilterSchoolTypes([]);
    setExportFilterBlocks([]);
    setIsExportSchoolsMatrixOpen(true);
  }

  function handleConfirmExportConsolidatedAttendance() {
    const totalSelected =
      exportFilterCategories.length +
      exportFilterSchoolTypes.length +
      exportFilterBlocks.length;

    if (totalSelected === 0) {
      toast.error("Please select at least one filter option or click 'Select All Filters'.");
      return;
    }

    setIsExportingConsolidated(true);
    startTransition(async () => {
      const res = await exportConsolidatedAttendanceExcelAction({
        categoryTypes: exportFilterCategories.length > 0 ? exportFilterCategories : undefined,
        schoolTypes: exportFilterSchoolTypes.length > 0 ? exportFilterSchoolTypes : undefined,
        blocks: exportFilterBlocks.length > 0 ? exportFilterBlocks : undefined,
      });
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
        setIsExportingConsolidated(false);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported master teachers attendance matrix (${res.count} schools)!`);
        setIsExportingConsolidated(false);
        setIsExportSchoolsMatrixOpen(false);
      }
    });
  }

  function handleExportConsolidatedBrteAttendance() {
    setIsExportingConsolidatedBrte(true);
    startTransition(async () => {
      const res = await exportConsolidatedBrteAttendanceExcelAction();
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
        setIsExportingConsolidatedBrte(false);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported master BRTE attendance matrix for all ${res.count} BRTEs!`);
        setIsExportingConsolidatedBrte(false);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // BRTE SESSION HANDLERS
  // ---------------------------------------------------------------------------

  function handleCreateBrteSession(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createBrteSessionAction({
        title: brteTitle,
        description: brteDescription,
        sessionDate: brteSessionDate,
        startTime: brteStartTime || undefined,
        endTime: brteEndTime || undefined,
        generalMeetUrl: brteMeetUrl,
        blocks: selectedBrteBlocks,
      });

      if (res.error) {
        toast.error(`Failed to create BRTE session: ${res.error}`);
      } else {
        toast.success("BRTE Session created successfully!");
        if (res.createdSession) {
          setBrteSessions((prev) => [res.createdSession, ...prev]);
        }
        setBrteTitle("");
        setBrteDescription("");
        setBrteSessionDate("");
        setBrteStartTime("");
        setBrteEndTime("");
        setBrteMeetUrl("");
        setSelectedBrteBlocks([]);
        setActiveTab("brte-sessions");
        router.refresh();
      }
    });
  }

  function openEditBrteSession(s: any) {
    setEditingBrteSession({
      id: s.id,
      title: s.title ?? "",
      description: s.description ?? "",
      generalMeetUrl: s.generalMeetUrl ?? "",
      sessionDate: formatDateForInput(s.sessionDate),
      startTime: formatTimeForInput(s.startTime),
      endTime: formatTimeForInput(s.endTime),
      blocks: s.blockRules ? s.blockRules.map((r: any) => r.block) : [],
    });
  }

  function handleUpdateBrteSession(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBrteSession) return;

    if (!editingBrteSession.title?.trim()) {
      toast.error("Please enter a session title.");
      return;
    }
    if (!editingBrteSession.generalMeetUrl?.trim()) {
      toast.error("Please enter a Google Meet URL.");
      return;
    }
    if (!editingBrteSession.sessionDate) {
      toast.error("Please select a session date.");
      return;
    }

    startTransition(async () => {
      const res = await updateBrteSessionAction(editingBrteSession.id, {
        title: editingBrteSession.title.trim(),
        description: editingBrteSession.description?.trim() || undefined,
        generalMeetUrl: editingBrteSession.generalMeetUrl.trim(),
        sessionDate: editingBrteSession.sessionDate,
        startTime: editingBrteSession.startTime || undefined,
        endTime: editingBrteSession.endTime || undefined,
        blocks: editingBrteSession.blocks || [],
      });
      if (res.error) {
        toast.error(`Update failed: ${res.error}`);
      } else {
        toast.success("BRTE Session updated successfully!");
        if (res.updatedSession) {
          setBrteSessions((prev) =>
            prev.map((s) => (s.id === editingBrteSession.id ? res.updatedSession : s))
          );
        }
        setEditingBrteSession(null);
        router.refresh();
      }
    });
  }

  function handleDeleteBrteSession(id: string) {
    if (!confirm("Are you sure you want to delete this BRTE session?")) return;
    startTransition(async () => {
      const res = await deleteBrteSessionAction(id);
      if (res.error) {
        toast.error(`Delete failed: ${res.error}`);
      } else {
        toast.success("BRTE Session deleted successfully!");
        setBrteSessions(brteSessions.filter((s) => s.id !== id));
        router.refresh();
      }
    });
  }

  function handleExportBrteSessionExcel(sessionId: string, sessionTitle: string) {
    setExportingBrteSessionId(sessionId);
    startTransition(async () => {
      const res = await exportBrteAttendanceExcelAction(sessionId);
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
        setExportingBrteSessionId(null);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported BRTE attendance for "${sessionTitle}" (${res.count} BRTEs)!`);
        setExportingBrteSessionId(null);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // SCHOOL HANDLERS
  // ---------------------------------------------------------------------------

  function handleAddSchool(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSchoolAction(newSchoolData);
      if (res.error) {
        toast.error(`Failed to add school: ${res.error}`);
      } else {
        toast.success("School added successfully!");
        setIsAddSchoolOpen(false);
        setNewSchoolData({
          udise: "",
          name: "",
          educationDistrict: "MADURAI",
          block: "",
          schoolType: "Government",
          management: "",
          category: "",
          categoryType: null,
        });
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
        management: editingSchool.management,
        categoryType: editingSchool.categoryType,
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
        toast.error(`Failed to update school category: ${res.error}`);
      } else {
        const catLabel = categoryType ? categoryType.replace("_", " ") : "None";
        toast.success(`School category updated to ${catLabel}`);
        setSchools(schools.map((s) => (s.udise === udise ? { ...s, categoryType } : s)));
        router.refresh();
      }
    });
  }

  function handleDeleteSchool(udise: string) {
    if (!confirm("Are you sure you want to delete this school?")) return;
    startTransition(async () => {
      const res = await deleteSchoolAction(udise);
      if (res.error) {
        toast.error(`Delete failed: ${res.error}`);
      } else {
        toast.success("School deleted successfully!");
        setSchools(schools.filter((s) => s.udise !== udise));
        router.refresh();
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
              <span className="font-extrabold text-base tracking-tight text-gray-900 block leading-tight truncate">
                CEO - Madurai
              </span>
              <span className="text-xs font-bold text-black uppercase tracking-wider block truncate">
                Gmeet Attendance Portal (Admin)
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
            { id: "sessions", label: "Teachers Sessions", icon: Video },
            { id: "new-session", label: "New Teachers Session", icon: Plus },
            { id: "brte-sessions", label: "BRTE Sessions", icon: BookOpen },
            { id: "new-brte-session", label: "New BRTE Session", icon: Plus },
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Card>
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
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">Teachers Sessions</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{sessions.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-[hsl(213,56%,24%)]/10 text-[hsl(213,56%,24%)] shrink-0">
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">BRTE Sessions</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{brteSessions.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <h2 className="text-lg font-bold text-gray-900">Recent Sessions Overview</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleExportConsolidatedAttendance}
                  disabled={isExportingConsolidated || sessions.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidated ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export Master Schools Matrix
                </Button>
                <Button
                  onClick={handleExportConsolidatedBrteAttendance}
                  disabled={isExportingConsolidatedBrte || brteSessions.length === 0}
                  className="bg-purple-700 hover:bg-purple-800 text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidatedBrte ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export Master BRTE Matrix
                </Button>
                <Button onClick={() => setActiveTab("new-session")} className="gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule Teachers Session
                </Button>
                <Button onClick={() => setActiveTab("new-brte-session")} variant="outline" className="gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule BRTE Session
                </Button>
              </div>
            </div>

            {/* Teachers Sessions summary table */}
            <Card>
              <CardHeader className="py-4 border-b border-gray-100 bg-gray-50/50">
                <CardTitle className="text-base flex items-center gap-2">
                  <Video className="w-4 h-4 text-blue-600" />
                  Teachers Sessions
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Google Meet Link</TableHead>
                        <TableHead>Target Rules</TableHead>
                        <TableHead>Exports</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.slice(0, 5).map((s) => {
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
                              {(!s.categoryRules?.length && !s.schoolTypeRules?.length && !s.blockRules?.length) ? (
                                <Badge variant="secondary">All Schools</Badge>
                              ) : (
                                <div className="flex gap-1 flex-wrap max-w-[220px]">
                                  {s.categoryRules?.map((r: any) => (
                                    <Badge key={r.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{r.categoryType.replace("_", " ")}</Badge>
                                  ))}
                                  {s.schoolTypeRules?.map((r: any) => (
                                    <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.schoolType}</Badge>
                                  ))}
                                  {s.blockRules?.map((r: any) => (
                                    <Badge key={r.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{r.block}</Badge>
                                  ))}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                className="h-8 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                onClick={() => handleExportSessionExcel(s.id, s.title)}
                                disabled={exportingSessionId === s.id}
                              >
                                {exportingSessionId === s.id ? (
                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3 mr-1" />
                                )}
                                Export
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-8 w-8 text-gray-500">
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

            {/* BRTE Sessions summary */}
            {brteSessions.length > 0 && (
              <Card>
                <CardHeader className="py-4 border-b border-gray-100 bg-gray-50/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-purple-600" />
                    BRTE Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-[700px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Google Meet Link</TableHead>
                          <TableHead>Target Blocks</TableHead>
                          <TableHead>Exports</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {brteSessions.slice(0, 5).map((s) => {
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
                                {(!s.blockRules || s.blockRules.length === 0) ? (
                                  <Badge variant="secondary">All BRTEs</Badge>
                                ) : (
                                  <div className="flex gap-1 flex-wrap max-w-[220px]">
                                    {s.blockRules.map((r: any) => (
                                      <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.block}</Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  className="h-8 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                                  onClick={() => handleExportBrteSessionExcel(s.id, s.title)}
                                  disabled={exportingBrteSessionId === s.id}
                                >
                                  {exportingBrteSessionId === s.id ? (
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Download className="w-3 h-3 mr-1" />
                                  )}
                                  Export
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => openEditBrteSession(s)} className="h-8 w-8 text-gray-500">
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDeleteBrteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
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
            )}
          </div>
        )}

        {/* ── TAB 2: TEACHERS SESSIONS LIST ── */}
        {activeTab === "sessions" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Teachers Training Sessions</h2>
                <p className="text-sm text-gray-500">Manage teachers sessions and export attendance.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <Button
                  onClick={handleExportConsolidatedAttendance}
                  disabled={isExportingConsolidated || sessions.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidated ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export Master Schools Matrix
                </Button>
                <Button onClick={() => setActiveTab("new-session")} className="w-full sm:w-auto gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule Teachers Session
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table className="min-w-[700px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Target Rules</TableHead>
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
                              {(!s.categoryRules?.length && !s.schoolTypeRules?.length && !s.blockRules?.length) ? (
                                <Badge variant="secondary">All Schools</Badge>
                              ) : (
                                <div className="flex gap-1 flex-wrap max-w-[220px]">
                                  {s.categoryRules?.map((r: any) => (
                                    <Badge key={r.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{r.categoryType.replace("_", " ")}</Badge>
                                  ))}
                                  {s.schoolTypeRules?.map((r: any) => (
                                    <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.schoolType}</Badge>
                                  ))}
                                  {s.blockRules?.map((r: any) => (
                                    <Badge key={r.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{r.block}</Badge>
                                  ))}
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
                              <Button
                                size="sm"
                                className="h-8 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                onClick={() => handleExportSessionExcel(s.id, s.title)}
                                disabled={exportingSessionId === s.id}
                              >
                                {exportingSessionId === s.id ? (
                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3 mr-1" />
                                )}
                                Export Excel
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-8 w-8 text-gray-500">
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

        {/* ── TAB 3: CREATE NEW TEACHERS SESSION ── */}
        {activeTab === "new-session" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
            <Card>
              <CardHeader className="border-b border-gray-100 bg-gray-50/50">
                <CardTitle>Schedule Teachers Session</CardTitle>
                <CardDescription>
                  Create a new training schedule and specify target school categories.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateSession} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Teachers Session Title <span className="text-red-500">*</span></label>
                    <Input placeholder="e.g. Teacher Orientation Session 1" value={title} onChange={(e) => setTitle(e.target.value)} required />
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

                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">1. Target School Category Types</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {CATEGORY_TYPE_OPTIONS.map((cat) => {
                          const isSelected = selectedCategories.includes(cat.id);
                          return (
                            <div
                              key={cat.id}
                              onClick={() => {
                                if (isSelected) {
                                  setSelectedCategories(selectedCategories.filter((c) => c !== cat.id));
                                } else {
                                  setSelectedCategories([...selectedCategories, cat.id]);
                                }
                              }}
                              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                                isSelected
                                  ? "bg-blue-50 border-blue-600 text-blue-900"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"}`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="text-xs font-semibold">{cat.label}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2 pt-3 border-t border-gray-100">
                      <label className="text-sm font-semibold text-gray-700">2. Target School Types</label>
                      {availableSchoolTypes.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No school type options found in database.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                          {availableSchoolTypes.map((st) => {
                            const isSelected = selectedSchoolTypes.includes(st);
                            return (
                              <div
                                key={st}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedSchoolTypes(selectedSchoolTypes.filter((s) => s !== st));
                                  } else {
                                    setSelectedSchoolTypes([...selectedSchoolTypes, st]);
                                  }
                                }}
                                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                                  isSelected
                                    ? "bg-purple-50 border-purple-600 text-purple-900"
                                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 bg-white"}`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="text-xs font-semibold truncate">{st}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-3 border-t border-gray-100">
                      <label className="text-sm font-semibold text-gray-700">3. Target School Blocks</label>
                      {availableBlocks.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No block options found in database.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                          {availableBlocks.map((blk) => {
                            const isSelected = selectedBlocks.includes(blk);
                            return (
                              <div
                                key={blk}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedBlocks(selectedBlocks.filter((b) => b !== blk));
                                  } else {
                                    setSelectedBlocks([...selectedBlocks, blk]);
                                  }
                                }}
                                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                                  isSelected
                                    ? "bg-emerald-50 border-emerald-600 text-emerald-900"
                                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 bg-white"}`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="text-xs font-semibold truncate">{blk}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 pt-1">
                      {selectedCategories.length === 0 && selectedSchoolTypes.length === 0 && selectedBlocks.length === 0
                        ? "No filters selected. Session will be visible to ALL active teachers."
                        : `Targeting: ${selectedCategories.length > 0 ? `${selectedCategories.length} Category Type(s)` : "All Categories"} AND ${selectedSchoolTypes.length > 0 ? `${selectedSchoolTypes.length} School Type(s)` : "All School Types"} AND ${selectedBlocks.length > 0 ? `${selectedBlocks.length} Block(s)` : "All Blocks"}.`}
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

        {/* ── TAB 4: BRTE SESSIONS LIST ── */}
        {activeTab === "brte-sessions" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">BRTE Training Sessions</h2>
                <p className="text-sm text-gray-500">Manage BRTE sessions and export BRTE attendance.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <Button
                  onClick={handleExportConsolidatedBrteAttendance}
                  disabled={isExportingConsolidatedBrte || brteSessions.length === 0}
                  className="bg-purple-700 hover:bg-purple-800 text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidatedBrte ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export Master BRTE Matrix
                </Button>
                <Button onClick={() => setActiveTab("new-brte-session")} className="w-full sm:w-auto gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule BRTE Session
                </Button>
              </div>
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
                        <TableHead>Target Blocks</TableHead>
                        <TableHead>Exports</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brteSessions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No BRTE sessions scheduled yet. Click &quot;Schedule BRTE Session&quot; to create one.
                          </TableCell>
                        </TableRow>
                      ) : (
                        brteSessions.map((s) => {
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
                                {(!s.blockRules || s.blockRules.length === 0) ? (
                                  <Badge variant="secondary">All BRTEs</Badge>
                                ) : (
                                  <div className="flex gap-1 flex-wrap max-w-[220px]">
                                    {s.blockRules.map((r: any) => (
                                      <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.block}</Badge>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  className="h-8 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100"
                                  onClick={() => handleExportBrteSessionExcel(s.id, s.title)}
                                  disabled={exportingBrteSessionId === s.id}
                                >
                                  {exportingBrteSessionId === s.id ? (
                                    <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                  ) : (
                                    <Download className="w-3 h-3 mr-1" />
                                  )}
                                  Export Excel
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => openEditBrteSession(s)} className="h-8 w-8 text-gray-500">
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDeleteBrteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 5: CREATE NEW BRTE SESSION ── */}
        {activeTab === "new-brte-session" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
            <Card>
              <CardHeader className="border-b border-gray-100 bg-gray-50/50">
                <CardTitle>Schedule BRTE Session</CardTitle>
                <CardDescription>
                  Create a new training session exclusively for BRTEs with optional block targeting.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateBrteSession} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">BRTE Session Title <span className="text-red-500">*</span></label>
                    <Input placeholder="e.g. BRTE Monthly Review & NMMS Planning" value={brteTitle} onChange={(e) => setBrteTitle(e.target.value)} required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Description</label>
                    <Input placeholder="Brief agenda or instructions for BRTEs" value={brteDescription} onChange={(e) => setBrteDescription(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-sm font-semibold text-gray-700">Date <span className="text-red-500">*</span></label>
                      <Input type="date" value={brteSessionDate} onChange={(e) => setBrteSessionDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Start Time</label>
                      <Input type="time" value={brteStartTime} onChange={(e) => setBrteStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">End Time</label>
                      <Input type="time" value={brteEndTime} onChange={(e) => setBrteEndTime(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Google Meet URL <span className="text-red-500">*</span></label>
                    <Input placeholder="https://meet.google.com/abc-defg-hij" value={brteMeetUrl} onChange={(e) => setBrteMeetUrl(e.target.value)} required />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">Target BRTE Blocks (Optional)</label>
                      {availableBrteBlocks.length === 0 ? (
                        <p className="text-xs text-gray-500 italic">No BRTE blocks found in database.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                          {availableBrteBlocks.map((blk) => {
                            const isSelected = selectedBrteBlocks.includes(blk);
                            return (
                              <div
                                key={blk}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedBrteBlocks(selectedBrteBlocks.filter((b) => b !== blk));
                                  } else {
                                    setSelectedBrteBlocks([...selectedBrteBlocks, blk]);
                                  }
                                }}
                                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                                  isSelected
                                    ? "bg-purple-50 border-purple-600 text-purple-900"
                                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                                }`}
                              >
                                <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 bg-white"}`}>
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <div className="text-xs font-semibold truncate">{blk}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 pt-1">
                      {selectedBrteBlocks.length === 0
                        ? "No block filters selected. Session will be visible to ALL active BRTEs."
                        : `Targeting BRTEs in ${selectedBrteBlocks.length} block(s): ${selectedBrteBlocks.join(", ")}.`}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? "Creating..." : "Save BRTE Session"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 6: SCHOOLS DIRECTORY ── */}
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
                        <TableHead>Management</TableHead>
                        <TableHead>Block / District</TableHead>
                        <TableHead>Category Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSchools.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            No schools match your search.
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedSchools.map((sc) => (
                          <TableRow key={sc.udise}>
                            <TableCell className="font-mono font-bold text-[hsl(213,56%,24%)]">{sc.udise}</TableCell>
                            <TableCell className="font-semibold text-gray-900 max-w-xs truncate">{sc.name}</TableCell>
                            <TableCell className="text-xs text-purple-800 font-medium max-w-[180px] truncate">{sc.management ?? "—"}</TableCell>
                            <TableCell className="text-gray-600 text-xs">{sc.block ?? "—"} / {sc.educationDistrict ?? "—"}</TableCell>
                            <TableCell>
                              <select
                                value={sc.categoryType ?? ""}
                                onChange={(e) =>
                                  handleQuickCategoryChange(
                                    sc.udise,
                                    e.target.value ? (e.target.value as CategoryType) : null
                                  )
                                }
                                className="h-8 rounded-md bg-white border border-gray-300 text-xs px-2 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[hsl(213,56%,24%)]"
                              >
                                <option value="">Unspecified</option>
                                {CATEGORY_TYPE_OPTIONS.map((opt) => (
                                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                                ))}
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
                  <Input required placeholder="Higher Secondary School..." value={newSchoolData.name} onChange={(e) => setNewSchoolData({ ...newSchoolData, name: e.target.value })} />
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
                  <label className="font-semibold text-gray-700">Management</label>
                  <Input placeholder="School Education Department School" value={newSchoolData.management ?? ""} onChange={(e) => setNewSchoolData({ ...newSchoolData, management: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Category Type</label>
                  <select
                    value={newSchoolData.categoryType ?? ""}
                    onChange={(e) => setNewSchoolData({ ...newSchoolData, categoryType: e.target.value ? (e.target.value as CategoryType) : null })}
                    className="w-full h-10 rounded-md bg-white border border-gray-300 px-3 text-gray-900 focus:ring-2 focus:ring-[hsl(213,56%,24%)] focus:outline-none"
                  >
                    <option value="">Unspecified</option>
                    {CATEGORY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
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
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Management</label>
                  <Input value={editingSchool.management ?? ""} onChange={(e) => setEditingSchool({ ...editingSchool, management: e.target.value })} />
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
                    {CATEGORY_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <Button type="submit" className="w-full mt-2" disabled={isPending}>Save Changes</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* EDIT TEACHERS SESSION MODAL */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] shadow-2xl border-0 flex flex-col overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4 shrink-0">
              <CardTitle className="text-lg">Edit Teachers Session</CardTitle>
              <button onClick={() => setEditingSession(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 pt-5 pb-2">
              <form id="edit-session-form" onSubmit={handleUpdateSession} className="space-y-4 text-sm">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Session Title <span className="text-red-500">*</span></label>
                  <Input value={editingSession.title ?? ""} onChange={(e) => setEditingSession({ ...editingSession, title: e.target.value })} />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="font-semibold text-gray-700">Date <span className="text-red-500">*</span></label>
                    <Input type="date" value={editingSession.sessionDate ?? ""} onChange={(e) => setEditingSession({ ...editingSession, sessionDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">Start Time</label>
                    <Input type="time" value={editingSession.startTime ?? ""} onChange={(e) => setEditingSession({ ...editingSession, startTime: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">End Time</label>
                    <Input type="time" value={editingSession.endTime ?? ""} onChange={(e) => setEditingSession({ ...editingSession, endTime: e.target.value })} />
                  </div>
                </div>

                {/* Meet URL */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Google Meet URL <span className="text-red-500">*</span></label>
                  <Input value={editingSession.generalMeetUrl ?? ""} onChange={(e) => setEditingSession({ ...editingSession, generalMeetUrl: e.target.value })} />
                </div>

                {/* Target Rules */}
                <div className="space-y-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Target Rules — only matching schools receive the Meet link</p>

                  {/* Category Types */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700">1. School Category Types</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {CATEGORY_TYPE_OPTIONS.map((cat) => {
                        const isSelected = (editingSession.categoryTypes || []).includes(cat.id);
                        return (
                          <div
                            key={cat.id}
                            onClick={() => {
                              const current: string[] = editingSession.categoryTypes || [];
                              setEditingSession({
                                ...editingSession,
                                categoryTypes: isSelected
                                  ? current.filter((c: string) => c !== cat.id)
                                  : [...current, cat.id],
                              });
                            }}
                            className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                              isSelected
                                ? "bg-blue-50 border-blue-600 text-blue-900"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"}`}>
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                            <div className="text-xs font-semibold">{cat.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* School Types */}
                  {availableSchoolTypes.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <label className="text-xs font-semibold text-gray-700">2. School Types</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                        {availableSchoolTypes.map((st) => {
                          const isSelected = (editingSession.schoolTypes || []).includes(st);
                          return (
                            <div
                              key={st}
                              onClick={() => {
                                const current: string[] = editingSession.schoolTypes || [];
                                setEditingSession({
                                  ...editingSession,
                                  schoolTypes: isSelected
                                    ? current.filter((s: string) => s !== st)
                                    : [...current, st],
                                });
                              }}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                                isSelected
                                  ? "bg-purple-50 border-purple-600 text-purple-900"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 bg-white"}`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="text-xs font-semibold truncate">{st}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Blocks */}
                  {availableBlocks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <label className="text-xs font-semibold text-gray-700">3. Target Blocks</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                        {availableBlocks.map((blk) => {
                          const isSelected = (editingSession.blocks || []).includes(blk);
                          return (
                            <div
                              key={blk}
                              onClick={() => {
                                const current: string[] = editingSession.blocks || [];
                                setEditingSession({
                                  ...editingSession,
                                  blocks: isSelected
                                    ? current.filter((b: string) => b !== blk)
                                    : [...current, blk],
                                });
                              }}
                              className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                                isSelected
                                  ? "bg-emerald-50 border-emerald-600 text-emerald-900"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 bg-white"}`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="text-xs font-semibold truncate">{blk}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 pt-1">
                    {(!editingSession.categoryTypes?.length && !editingSession.schoolTypes?.length && !editingSession.blocks?.length)
                      ? "No filters selected — session visible to ALL active teachers."
                      : `Targeting: ${editingSession.categoryTypes?.length ? `${editingSession.categoryTypes.length} Category Type(s)` : "All Categories"} AND ${editingSession.schoolTypes?.length ? `${editingSession.schoolTypes.length} School Type(s)` : "All School Types"} AND ${editingSession.blocks?.length ? `${editingSession.blocks.length} Block(s)` : "All Blocks"}.`}
                  </p>
                </div>
              </form>
            </CardContent>
            <CardFooter className="border-t border-gray-100 pt-4 pb-4 shrink-0">
              <Button type="submit" form="edit-session-form" className="w-full" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* EDIT BRTE SESSION MODAL */}
      {editingBrteSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] shadow-2xl border-0 flex flex-col overflow-hidden">
            <CardHeader className="border-b border-gray-100 bg-gray-50/50 flex flex-row items-center justify-between py-4 shrink-0">
              <CardTitle className="text-lg">Edit BRTE Session</CardTitle>
              <button onClick={() => setEditingBrteSession(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 pt-5 pb-2">
              <form id="edit-brte-session-form" onSubmit={handleUpdateBrteSession} className="space-y-4 text-sm">
                {/* Title */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Session Title <span className="text-red-500">*</span></label>
                  <Input value={editingBrteSession.title ?? ""} onChange={(e) => setEditingBrteSession({ ...editingBrteSession, title: e.target.value })} />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="font-semibold text-gray-700">Date <span className="text-red-500">*</span></label>
                    <Input type="date" value={editingBrteSession.sessionDate ?? ""} onChange={(e) => setEditingBrteSession({ ...editingBrteSession, sessionDate: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">Start Time</label>
                    <Input type="time" value={editingBrteSession.startTime ?? ""} onChange={(e) => setEditingBrteSession({ ...editingBrteSession, startTime: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-gray-700">End Time</label>
                    <Input type="time" value={editingBrteSession.endTime ?? ""} onChange={(e) => setEditingBrteSession({ ...editingBrteSession, endTime: e.target.value })} />
                  </div>
                </div>

                {/* Meet URL */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Google Meet URL <span className="text-red-500">*</span></label>
                  <Input value={editingBrteSession.generalMeetUrl ?? ""} onChange={(e) => setEditingBrteSession({ ...editingBrteSession, generalMeetUrl: e.target.value })} />
                </div>

                {/* Target Blocks */}
                {availableBrteBlocks.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Target Rules — only matching BRTEs receive the Meet link</p>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-700">Target BRTE Blocks</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {availableBrteBlocks.map((blk) => {
                          const isSelected = (editingBrteSession.blocks || []).includes(blk);
                          return (
                            <div
                              key={blk}
                              onClick={() => {
                                const current: string[] = editingBrteSession.blocks || [];
                                setEditingBrteSession({
                                  ...editingBrteSession,
                                  blocks: isSelected
                                    ? current.filter((b: string) => b !== blk)
                                    : [...current, blk],
                                });
                              }}
                              className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                                isSelected
                                  ? "bg-purple-50 border-purple-600 text-purple-900"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 bg-white"}`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="text-xs font-semibold truncate">{blk}</div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500">
                        {(!editingBrteSession.blocks?.length)
                          ? "No blocks selected — session visible to ALL active BRTEs."
                          : `Targeting ${editingBrteSession.blocks.length} Block(s).`}
                      </p>
                    </div>
                  </div>
                )}
              </form>
            </CardContent>
            <CardFooter className="border-t border-gray-100 pt-4 pb-4 shrink-0">
              <Button type="submit" form="edit-brte-session-form" className="w-full" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* EXPORT MASTER SCHOOLS MATRIX FILTER MODAL */}
      {isExportSchoolsMatrixOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] shadow-2xl border-0 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50/30 flex flex-row items-center justify-between py-4 px-6 shrink-0">
              <div>
                <CardTitle className="text-lg text-emerald-950 flex items-center gap-2">
                  <Download className="w-5 h-5 text-emerald-600" /> Export Master Schools Matrix
                </CardTitle>
                <CardDescription className="text-xs text-emerald-800/80 mt-0.5">
                  Filter by Category Types, School Types, and Blocks before exporting.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setExportFilterCategories(CATEGORY_TYPE_OPTIONS.map((c) => c.id));
                    setExportFilterSchoolTypes([...availableSchoolTypes]);
                    setExportFilterBlocks([...availableBlocks]);
                  }}
                  className="h-8 text-xs font-semibold border-emerald-300 text-emerald-800 hover:bg-emerald-100/50 bg-white"
                >
                  Select All Filters
                </Button>
                <button
                  onClick={() => setIsExportSchoolsMatrixOpen(false)}
                  className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 px-6 space-y-5 overflow-y-auto flex-1">
              {/* FILTER 1: SCHOOL CATEGORY TYPES */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                    1. Target School Category Types
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {exportFilterCategories.length}/{CATEGORY_TYPE_OPTIONS.length}
                    </Badge>
                  </label>
                  <button
                    type="button"
                    onClick={() => setExportFilterCategories(CATEGORY_TYPE_OPTIONS.map((c) => c.id))}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CATEGORY_TYPE_OPTIONS.map((cat) => {
                    const isSelected = exportFilterCategories.includes(cat.id);
                    return (
                      <div
                        key={cat.id}
                        onClick={() => {
                          if (isSelected) {
                            setExportFilterCategories(exportFilterCategories.filter((c) => c !== cat.id));
                          } else {
                            setExportFilterCategories([...exportFilterCategories, cat.id]);
                          }
                        }}
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="text-xs font-semibold">{cat.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FILTER 2: SCHOOL TYPES */}
              <div className="space-y-2.5 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                    2. Target School Types
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {exportFilterSchoolTypes.length}/{availableSchoolTypes.length}
                    </Badge>
                  </label>
                  <button
                    type="button"
                    onClick={() => setExportFilterSchoolTypes([...availableSchoolTypes])}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Select All
                  </button>
                </div>
                {availableSchoolTypes.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No school type options found in database.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableSchoolTypes.map((st) => {
                      const isSelected = exportFilterSchoolTypes.includes(st);
                      return (
                        <div
                          key={st}
                          onClick={() => {
                            if (isSelected) {
                              setExportFilterSchoolTypes(exportFilterSchoolTypes.filter((s) => s !== st));
                            } else {
                              setExportFilterSchoolTypes([...exportFilterSchoolTypes, st]);
                            }
                          }}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                            isSelected
                              ? "bg-purple-50 border-purple-600 text-purple-950 shadow-xs"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-purple-600 bg-purple-600 text-white" : "border-gray-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="text-xs font-semibold truncate">{st}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* FILTER 3: SCHOOL BLOCKS */}
              <div className="space-y-2.5 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                    3. Target School Blocks
                    <Badge variant="secondary" className="text-[10px] font-semibold">
                      {exportFilterBlocks.length}/{availableBlocks.length}
                    </Badge>
                  </label>
                  <button
                    type="button"
                    onClick={() => setExportFilterBlocks([...availableBlocks])}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Select All
                  </button>
                </div>
                {availableBlocks.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No block options found in database.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {availableBlocks.map((blk) => {
                      const isSelected = exportFilterBlocks.includes(blk);
                      return (
                        <div
                          key={blk}
                          onClick={() => {
                            if (isSelected) {
                              setExportFilterBlocks(exportFilterBlocks.filter((b) => b !== blk));
                            } else {
                              setExportFilterBlocks([...exportFilterBlocks, blk]);
                            }
                          }}
                          className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2 ${
                            isSelected
                              ? "bg-amber-50 border-amber-600 text-amber-950 shadow-xs"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-amber-600 bg-amber-600 text-white" : "border-gray-300 bg-white"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="text-xs font-semibold truncate">{blk}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* VALIDATION & INTERSECTION STATUS */}
              {(exportFilterCategories.length + exportFilterSchoolTypes.length + exportFilterBlocks.length === 0) ? (
                <div className="rounded-lg bg-blue-50/80 border border-blue-200 p-3 text-xs text-blue-900 flex items-center gap-2">
                  <span>ℹ️ Select any option(s) to filter by strict intersection, or click <strong>&quot;Select All Filters&quot;</strong> to export all schools.</span>
                </div>
              ) : (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="font-semibold text-emerald-900">Strict Intersection (AND):</span>
                  <span className="font-medium text-emerald-800">
                    {[
                      exportFilterCategories.length > 0 ? `${exportFilterCategories.length} Category Type(s)` : null,
                      exportFilterSchoolTypes.length > 0 ? `${exportFilterSchoolTypes.length} School Type(s)` : null,
                      exportFilterBlocks.length > 0 ? `${exportFilterBlocks.length} Block(s)` : null,
                    ].filter(Boolean).join(" • ")}
                  </span>
                </div>
              )}
            </CardContent>

            <div className="p-4 px-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end gap-2.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsExportSchoolsMatrixOpen(false)}
                disabled={isExportingConsolidated}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmExportConsolidatedAttendance}
                disabled={
                  isExportingConsolidated ||
                  exportFilterCategories.length + exportFilterSchoolTypes.length + exportFilterBlocks.length === 0
                }
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 shadow-xs"
              >
                {isExportingConsolidated ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download Matrix (.xlsx)
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
