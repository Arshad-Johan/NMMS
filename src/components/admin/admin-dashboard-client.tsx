"use client";

import { useState, useTransition, useMemo } from "react";
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
  GraduationCap,
  CheckCircle2,
  CheckSquare,
} from "lucide-react";
import { CategoryType } from "@prisma/client";

type Tab =
  | "overview"
  | "hm-sessions"
  | "new-hm-session"
  | "nmms-sessions"
  | "new-nmms-session"
  | "brte-sessions"
  | "new-brte-session"
  | "schools";

interface AdminDashboardProps {
  adminName: string;
  availableSchoolTypes?: string[];
  availableBlocks?: string[];
  availableBrteBlocks?: string[];
  stats: {
    totalSchools: number;
    totalSessions: number;
    totalHmSessions?: number;
    totalNmmsSessions?: number;
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

  // Separate form state for HM Session
  const [hmTitle, setHmTitle] = useState("");
  const [hmDescription, setHmDescription] = useState("");
  const [hmSessionDate, setHmSessionDate] = useState("");
  const [hmStartTime, setHmStartTime] = useState("");
  const [hmEndTime, setHmEndTime] = useState("");
  const [hmGeneralMeetUrl, setHmGeneralMeetUrl] = useState("");
  const [hmSelectedCategories, setHmSelectedCategories] = useState<CategoryType[]>([]);
  const [hmSelectedSchoolTypes, setHmSelectedSchoolTypes] = useState<string[]>([]);
  const [hmSelectedBlocks, setHmSelectedBlocks] = useState<string[]>([]);

  // Separate form state for NMMS Session
  const [nmmsTitle, setNmmsTitle] = useState("");
  const [nmmsDescription, setNmmsDescription] = useState("");
  const [nmmsSessionDate, setNmmsSessionDate] = useState("");
  const [nmmsStartTime, setNmmsStartTime] = useState("");
  const [nmmsEndTime, setNmmsEndTime] = useState("");
  const [nmmsGeneralMeetUrl, setNmmsGeneralMeetUrl] = useState("");
  const [nmmsSelectedCategories, setNmmsSelectedCategories] = useState<CategoryType[]>([]);
  const [nmmsSelectedSchoolTypes, setNmmsSelectedSchoolTypes] = useState<string[]>([]);
  const [nmmsSelectedBlocks, setNmmsSelectedBlocks] = useState<string[]>([]);
  const [nmmsIncludeBrte, setNmmsIncludeBrte] = useState(false);

  // Session type for Master Matrix export modal
  const [exportMatrixSessionType, setExportMatrixSessionType] = useState<"HM" | "NMMS">("HM");

  // Filtered sessions by type
  const hmSessions = useMemo(() => sessions.filter((s) => s.sessionType === "HM"), [sessions]);
  const nmmsSessions = useMemo(() => sessions.filter((s) => s.sessionType !== "HM"), [sessions]);

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

  // Pagination Calculations for Schools
  const totalSchoolPages = Math.max(1, Math.ceil(filteredSchools.length / ITEMS_PER_PAGE));
  const currentSchoolPage = Math.min(schoolPage, totalSchoolPages);
  const paginatedSchools = filteredSchools.slice(
    (currentSchoolPage - 1) * ITEMS_PER_PAGE,
    currentSchoolPage * ITEMS_PER_PAGE
  );

  // Session Pagination States
  const [hmPage, setHmPage] = useState(1);
  const [nmmsPage, setNmmsPage] = useState(1);
  const [brtePage, setBrtePage] = useState(1);

  // Row Selection States (Dedicated WhatsApp-web style selection)
  const [selectedHmSessionIds, setSelectedHmSessionIds] = useState<string[]>([]);
  const [selectedNmmsSessionIds, setSelectedNmmsSessionIds] = useState<string[]>([]);
  const [selectedBrteSessionIds, setSelectedBrteSessionIds] = useState<string[]>([]);

  const [isExportingSelectedHm, setIsExportingSelectedHm] = useState(false);
  const [isExportingSelectedNmms, setIsExportingSelectedNmms] = useState(false);
  const [isExportingSelectedBrte, setIsExportingSelectedBrte] = useState(false);

  // Session Pagination Calculations
  const totalHmPages = Math.max(1, Math.ceil(hmSessions.length / ITEMS_PER_PAGE));
  const currentHmPage = Math.min(hmPage, totalHmPages);
  const paginatedHmSessions = hmSessions.slice(
    (currentHmPage - 1) * ITEMS_PER_PAGE,
    currentHmPage * ITEMS_PER_PAGE
  );

  const totalNmmsPages = Math.max(1, Math.ceil(nmmsSessions.length / ITEMS_PER_PAGE));
  const currentNmmsPage = Math.min(nmmsPage, totalNmmsPages);
  const paginatedNmmsSessions = nmmsSessions.slice(
    (currentNmmsPage - 1) * ITEMS_PER_PAGE,
    currentNmmsPage * ITEMS_PER_PAGE
  );

  const totalBrtePages = Math.max(1, Math.ceil(brteSessions.length / ITEMS_PER_PAGE));
  const currentBrtePage = Math.min(brtePage, totalBrtePages);
  const paginatedBrteSessions = brteSessions.slice(
    (currentBrtePage - 1) * ITEMS_PER_PAGE,
    currentBrtePage * ITEMS_PER_PAGE
  );

  // Selection Handlers
  function toggleSelectHmSession(id: string) {
    setSelectedHmSessionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAllHmSessions(currentPaginated: any[]) {
    const pageIds = currentPaginated.map((s) => s.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedHmSessionIds.includes(id));
    if (allSelected) {
      setSelectedHmSessionIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedHmSessionIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function handleDownloadSelectedHm() {
    if (selectedHmSessionIds.length === 0) {
      toast.error("Please select at least one HM session to download.");
      return;
    }
    setIsExportingSelectedHm(true);
    startTransition(async () => {
      const res = await exportConsolidatedAttendanceExcelAction({
        sessionType: "HM",
        sessionIds: selectedHmSessionIds,
      });
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
        setIsExportingSelectedHm(false);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported matrix for ${selectedHmSessionIds.length} selected HM session(s)!`);
        setIsExportingSelectedHm(false);
      }
    });
  }

  function toggleSelectNmmsSession(id: string) {
    setSelectedNmmsSessionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAllNmmsSessions(currentPaginated: any[]) {
    const pageIds = currentPaginated.map((s) => s.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedNmmsSessionIds.includes(id));
    if (allSelected) {
      setSelectedNmmsSessionIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedNmmsSessionIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function handleDownloadSelectedNmms() {
    if (selectedNmmsSessionIds.length === 0) {
      toast.error("Please select at least one NMMS session to download.");
      return;
    }
    setIsExportingSelectedNmms(true);
    startTransition(async () => {
      const res = await exportConsolidatedAttendanceExcelAction({
        sessionType: "NMMS",
        sessionIds: selectedNmmsSessionIds,
      });
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
        setIsExportingSelectedNmms(false);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported matrix for ${selectedNmmsSessionIds.length} selected NMMS session(s)!`);
        setIsExportingSelectedNmms(false);
      }
    });
  }

  function toggleSelectBrteSession(id: string) {
    setSelectedBrteSessionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAllBrteSessions(currentPaginated: any[]) {
    const pageIds = currentPaginated.map((s) => s.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedBrteSessionIds.includes(id));
    if (allSelected) {
      setSelectedBrteSessionIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedBrteSessionIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  }

  function handleDownloadSelectedBrte() {
    if (selectedBrteSessionIds.length === 0) {
      toast.error("Please select at least one BRTE session to download.");
      return;
    }
    setIsExportingSelectedBrte(true);
    startTransition(async () => {
      const res = await exportConsolidatedBrteAttendanceExcelAction({
        sessionIds: selectedBrteSessionIds,
      });
      if (res.error || !res.base64 || !res.filename) {
        toast.error(`Export failed: ${res.error}`);
        setIsExportingSelectedBrte(false);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${res.base64}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported matrix for ${selectedBrteSessionIds.length} selected BRTE session(s)!`);
        setIsExportingSelectedBrte(false);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // HM & NMMS SESSION HANDLERS
  // ---------------------------------------------------------------------------

  function handleCreateHmSession(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSessionAction({
        sessionType: "HM",
        title: hmTitle,
        description: hmDescription,
        sessionDate: hmSessionDate,
        startTime: hmStartTime || undefined,
        endTime: hmEndTime || undefined,
        generalMeetUrl: hmGeneralMeetUrl,
        categoryTypes: hmSelectedCategories,
        schoolTypes: hmSelectedSchoolTypes,
        blocks: hmSelectedBlocks,
      });

      if (res.error) {
        toast.error(`Failed to create HM session: ${res.error}`);
      } else {
        toast.success("HM Training Session created successfully!");
        if (res.createdSession) {
          setSessions((prev) => [res.createdSession, ...prev]);
        }
        setHmTitle("");
        setHmDescription("");
        setHmSessionDate("");
        setHmStartTime("");
        setHmEndTime("");
        setHmGeneralMeetUrl("");
        setHmSelectedCategories([]);
        setHmSelectedSchoolTypes([]);
        setHmSelectedBlocks([]);
        setActiveTab("hm-sessions");
        router.refresh();
      }
    });
  }

  function handleCreateNmmsSession(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createSessionAction({
        sessionType: "NMMS",
        title: nmmsTitle,
        description: nmmsDescription,
        sessionDate: nmmsSessionDate,
        startTime: nmmsStartTime || undefined,
        endTime: nmmsEndTime || undefined,
        generalMeetUrl: nmmsGeneralMeetUrl,
        categoryTypes: nmmsSelectedCategories,
        schoolTypes: nmmsSelectedSchoolTypes,
        blocks: nmmsSelectedBlocks,
        includeBrte: nmmsIncludeBrte,
      });

      if (res.error) {
        toast.error(`Failed to create NMMS session: ${res.error}`);
      } else {
        toast.success("NMMS Training Session created successfully!");
        if (res.createdSession) {
          setSessions((prev) => [res.createdSession, ...prev]);
        }
        setNmmsTitle("");
        setNmmsDescription("");
        setNmmsSessionDate("");
        setNmmsStartTime("");
        setNmmsEndTime("");
        setNmmsGeneralMeetUrl("");
        setNmmsSelectedCategories([]);
        setNmmsSelectedSchoolTypes([]);
        setNmmsSelectedBlocks([]);
        setNmmsIncludeBrte(false);
        setActiveTab("nmms-sessions");
        router.refresh();
      }
    });
  }

  function openEditSession(s: any) {
    setEditingSession({
      id: s.id,
      sessionType: s.sessionType || "NMMS",
      title: s.title ?? "",
      description: s.description ?? "",
      generalMeetUrl: s.generalMeetUrl ?? "",
      sessionDate: formatDateForInput(s.sessionDate),
      startTime: formatTimeForInput(s.startTime),
      endTime: formatTimeForInput(s.endTime),
      categoryTypes: s.categoryRules ? s.categoryRules.map((r: any) => r.categoryType) : [],
      schoolTypes: s.schoolTypeRules ? s.schoolTypeRules.map((r: any) => r.schoolType) : [],
      blocks: s.blockRules ? s.blockRules.map((r: any) => r.block) : [],
      includeBrte: Boolean(s.includeBrte),
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
        sessionType: editingSession.sessionType,
        title: editingSession.title.trim(),
        description: editingSession.description?.trim() || undefined,
        generalMeetUrl: editingSession.generalMeetUrl.trim(),
        sessionDate: editingSession.sessionDate,
        startTime: editingSession.startTime || undefined,
        endTime: editingSession.endTime || undefined,
        categoryTypes: editingSession.categoryTypes || [],
        schoolTypes: editingSession.schoolTypes || [],
        blocks: editingSession.blocks || [],
        includeBrte: editingSession.includeBrte,
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

  function handleExportConsolidatedAttendance(type: "HM" | "NMMS") {
    setExportMatrixSessionType(type);
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
        sessionType: exportMatrixSessionType,
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
        toast.success(`Exported master ${exportMatrixSessionType} attendance matrix (${res.count} schools)!`);
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
    <div className="min-h-screen bg-[hsl(220,14%,96%)] text-gray-900 font-sans flex flex-col">
      {/* ── Header Navbar ── */}
      <header className="sticky top-0 z-40 bg-[hsl(213,56%,24%)] shadow-md">
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-[hsl(40,80%,50%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center text-white shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight truncate">
                CEO - Madurai
              </span>
              <span className="text-[10px] font-bold text-[hsl(40,80%,50%)] uppercase tracking-wider block truncate">
                Gmeet Attendance Portal (Admin)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9 ring-white/30">
                <AvatarFallback>AD</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-semibold text-white leading-tight">
                  {adminName}
                </div>
                <div className="text-xs text-white/70 font-medium">Administrator</div>
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

      {/* ── Responsive Navigation Tabs ── */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
          {[
            { id: "overview", label: "Dashboard", icon: Layers },
            { id: "hm-sessions", label: "HM Sessions", icon: GraduationCap },
            { id: "new-hm-session", label: "New HM Session", icon: Plus },
            { id: "nmms-sessions", label: "NMMS Sessions", icon: Video },
            { id: "new-nmms-session", label: "New NMMS Session", icon: Plus },
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
                className={`flex items-center gap-2 px-3 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                  isActive
                    ? "border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)]"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <Card>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">Total Schools</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{schools.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-[hsl(213,45%,94%)] text-[hsl(213,56%,24%)] shrink-0">
                    <SchoolIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">HM Sessions</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{hmSessions.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-indigo-50 text-indigo-700 shrink-0">
                    <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">NMMS Sessions</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{nmmsSessions.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-[hsl(213,45%,94%)] text-[hsl(213,56%,24%)] shrink-0">
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">BRTE Sessions</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-900">{brteSessions.length}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-purple-50 text-purple-700 shrink-0">
                    <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
              <h2 className="text-lg font-bold text-gray-900">Recent Sessions Overview</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => handleExportConsolidatedAttendance("HM")}
                  disabled={isExportingConsolidated || hmSessions.length === 0}
                  className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidated && exportMatrixSessionType === "HM" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export HM Matrix
                </Button>
                <Button
                  onClick={() => handleExportConsolidatedAttendance("NMMS")}
                  disabled={isExportingConsolidated || nmmsSessions.length === 0}
                  className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidated && exportMatrixSessionType === "NMMS" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export NMMS Matrix
                </Button>
                <Button
                  onClick={handleExportConsolidatedBrteAttendance}
                  disabled={isExportingConsolidatedBrte || brteSessions.length === 0}
                  className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidatedBrte ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export BRTE Matrix
                </Button>
                <Button onClick={() => setActiveTab("new-hm-session")} className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule HM Session
                </Button>
                <Button onClick={() => setActiveTab("new-nmms-session")} className="gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule NMMS Session
                </Button>
                <Button onClick={() => setActiveTab("new-brte-session")} variant="outline" className="gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule BRTE Session
                </Button>
              </div>
            </div>

            {/* Recent HM Sessions summary table */}
            <Card>
              <CardHeader className="py-4 border-b border-gray-200 bg-gray-50/80">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    Recent HM Sessions
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("hm-sessions")} className="text-xs text-indigo-600 font-semibold h-7">
                    View All ({hmSessions.length}) &rarr;
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {hmSessions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No HM sessions scheduled yet.</p>
                ) : (
                  <>
                    {/* Mobile card list */}
                    <div className="divide-y divide-gray-100 md:hidden">
                      {hmSessions.slice(0, 5).map((s) => {
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <div key={s.id} className="px-4 py-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{s.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  {formattedTime && <span className="ml-2">{formattedTime}</span>}
                                </p>
                              </div>
                              {expired && <Badge variant="secondary" className="text-[10px] shrink-0">Ended</Badge>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button size="sm" className="h-7 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                Export
                              </Button>
                              {expired ? (
                                <span className="text-xs text-gray-500 font-medium">Link closed</span>
                              ) : (
                                <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                                  Open Meet <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-7 w-7 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Date &amp; Time</TableHead>
                            <TableHead>Google Meet Link</TableHead>
                            <TableHead>Target Rules</TableHead>
                            <TableHead>Exports</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hmSessions.slice(0, 5).map((s) => {
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
                                  <div className="font-medium text-gray-900">{new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                                  {formattedTime && <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formattedTime}</div>}
                                </TableCell>
                                <TableCell>
                                  {expired ? <span className="text-xs text-gray-500 font-medium">Link closed</span> : (
                                    <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">Open Meet <ExternalLink className="w-3 h-3" /></a>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {(!s.categoryRules?.length && !s.schoolTypeRules?.length && !s.blockRules?.length) ? (
                                    <Badge variant="secondary">All Schools</Badge>
                                  ) : (
                                    <div className="flex gap-1 flex-wrap max-w-[220px]">
                                      {s.categoryRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{r.categoryType.replace("_", " ")}</Badge>)}
                                      {s.schoolTypeRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.schoolType}</Badge>)}
                                      {s.blockRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{r.block}</Badge>)}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" className="h-8 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                    {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                    Export
                                  </Button>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-8 w-8 text-gray-500"><Edit2 className="w-4 h-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                  </div>
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

            {/* Recent NMMS Sessions summary table */}
            <Card>
              <CardHeader className="py-4 border-b border-gray-200 bg-gray-50/80">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-blue-600" />
                    Recent NMMS Sessions
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab("nmms-sessions")} className="text-xs text-blue-600 font-semibold h-7">
                    View All ({nmmsSessions.length}) &rarr;
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {nmmsSessions.length === 0 ? (
                  <p className="py-6 text-center text-sm text-gray-500">No NMMS sessions scheduled yet.</p>
                ) : (
                  <>
                    {/* Mobile card list */}
                    <div className="divide-y divide-gray-100 md:hidden">
                      {nmmsSessions.slice(0, 5).map((s) => {
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <div key={s.id} className="px-4 py-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-gray-900 text-sm truncate">{s.title}</p>
                                  {s.includeBrte && (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                                      BRTEs Included
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  {formattedTime && <span className="ml-2">{formattedTime}</span>}
                                </p>
                              </div>
                              {expired && <Badge variant="secondary" className="text-[10px] shrink-0">Ended</Badge>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button size="sm" className="h-7 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                Export
                              </Button>
                              {expired ? (
                                <span className="text-xs text-gray-500 font-medium">Link closed</span>
                              ) : (
                                <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                                  Open Meet <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-7 w-7 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Date &amp; Time</TableHead>
                            <TableHead>Google Meet Link</TableHead>
                            <TableHead>Target Rules</TableHead>
                            <TableHead>Exports</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nmmsSessions.slice(0, 5).map((s) => {
                            const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                            const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                            return (
                              <TableRow key={s.id}>
                                <TableCell className="font-semibold text-gray-900">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate max-w-[200px]">{s.title}</span>
                                    {s.includeBrte && (
                                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                                        BRTEs
                                      </Badge>
                                    )}
                                    {expired && <Badge variant="secondary" className="text-[10px]">Ended</Badge>}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-gray-900">{new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                                  {formattedTime && <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formattedTime}</div>}
                                </TableCell>
                                <TableCell>
                                  {expired ? <span className="text-xs text-gray-500 font-medium">Link closed</span> : (
                                    <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">Open Meet <ExternalLink className="w-3 h-3" /></a>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {(!s.categoryRules?.length && !s.schoolTypeRules?.length && !s.blockRules?.length) ? (
                                    <Badge variant="secondary">All Schools</Badge>
                                  ) : (
                                    <div className="flex gap-1 flex-wrap max-w-[220px]">
                                      {s.categoryRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{r.categoryType.replace("_", " ")}</Badge>)}
                                      {s.schoolTypeRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.schoolType}</Badge>)}
                                      {s.blockRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{r.block}</Badge>)}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" className="h-8 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                    {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                    Export
                                  </Button>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-8 w-8 text-gray-500"><Edit2 className="w-4 h-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                  </div>
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

            {/* BRTE Sessions summary */}
            {brteSessions.length > 0 && (
              <div className="space-y-3">
                {/* Selection Action Bar */}
                {selectedBrteSessionIds.length > 0 && (
                  <div className="flex items-center justify-between p-3.5 bg-purple-50 border border-purple-200 rounded-xl shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center gap-2 text-purple-950 font-bold text-sm">
                      <div className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">
                        {selectedBrteSessionIds.length}
                      </div>
                      <span>BRTE Session(s) Selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleDownloadSelectedBrte}
                        disabled={isExportingSelectedBrte}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs h-8 shadow-xs"
                      >
                        {isExportingSelectedBrte ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Download Selected ({selectedBrteSessionIds.length})
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedBrteSessionIds([])}
                        className="text-xs text-gray-600 hover:text-gray-900 h-8"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                )}

                <Card>
                  <CardHeader className="py-4 border-b border-gray-200 bg-gray-50/80">
                    <CardTitle className="text-base flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      BRTE Sessions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Mobile card list */}
                    <div className="divide-y divide-gray-100 md:hidden">
                      {paginatedBrteSessions.map((s) => {
                        const isSelected = selectedBrteSessionIds.includes(s.id);
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <div key={s.id} className={`px-4 py-3 space-y-2 ${isSelected ? "bg-purple-50/50" : ""}`}>
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                aria-label="Select BRTE session"
                                checked={isSelected}
                                onChange={() => toggleSelectBrteSession(s.id)}
                                className="w-4 h-4 mt-1 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-semibold text-gray-900 text-sm truncate">{s.title}</p>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                      {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                      {formattedTime && <span className="ml-2">{formattedTime}</span>}
                                    </p>
                                  </div>
                                  {expired && <Badge variant="secondary" className="text-[10px] shrink-0">Ended</Badge>}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap mt-2">
                                  <Button size="sm" className="h-7 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100" onClick={() => handleExportBrteSessionExcel(s.id, s.title)} disabled={exportingBrteSessionId === s.id}>
                                    {exportingBrteSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                    Export
                                  </Button>
                                  {expired ? (
                                    <span className="text-xs text-gray-500 font-medium">Link closed</span>
                                  ) : (
                                    <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                                      Open Meet <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  <Button size="icon" variant="ghost" onClick={() => openEditBrteSession(s)} className="h-7 w-7 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></Button>
                                  <Button size="icon" variant="ghost" onClick={() => handleDeleteBrteSession(s.id)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12 text-center">
                              <input
                                type="checkbox"
                                aria-label="Select all BRTE sessions on page"
                                checked={
                                  paginatedBrteSessions.length > 0 &&
                                  paginatedBrteSessions.every((s) => selectedBrteSessionIds.includes(s.id))
                                }
                                onChange={() => toggleSelectAllBrteSessions(paginatedBrteSessions)}
                                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                              />
                            </TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Date &amp; Time</TableHead>
                            <TableHead>Google Meet Link</TableHead>
                            <TableHead>Target Blocks</TableHead>
                            <TableHead>Exports</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedBrteSessions.map((s) => {
                            const isSelected = selectedBrteSessionIds.includes(s.id);
                            const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                            const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                            return (
                              <TableRow key={s.id} className={isSelected ? "bg-purple-50/40" : ""}>
                                <TableCell className="w-12 text-center">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select session ${s.title}`}
                                    checked={isSelected}
                                    onChange={() => toggleSelectBrteSession(s.id)}
                                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell className="font-semibold text-gray-900">
                                  <div className="flex items-center gap-2"><span className="truncate max-w-[200px]">{s.title}</span>{expired && <Badge variant="secondary" className="text-[10px]">Ended</Badge>}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-gray-900">{new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                                  {formattedTime && <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formattedTime}</div>}
                                </TableCell>
                                <TableCell>
                                  {expired ? <span className="text-xs text-gray-500 font-medium">Link closed</span> : (
                                    <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">Open Meet <ExternalLink className="w-3 h-3" /></a>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {(!s.blockRules || s.blockRules.length === 0) ? <Badge variant="secondary">All BRTEs</Badge> : (
                                    <div className="flex gap-1 flex-wrap max-w-[220px]">{s.blockRules.map((r: any) => <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.block}</Badge>)}</div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button size="sm" className="h-8 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100" onClick={() => handleExportBrteSessionExcel(s.id, s.title)} disabled={exportingBrteSessionId === s.id}>
                                    {exportingBrteSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                    Export
                                  </Button>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button size="icon" variant="ghost" onClick={() => openEditBrteSession(s)} className="h-8 w-8 text-gray-500"><Edit2 className="w-4 h-4" /></Button>
                                    <Button size="icon" variant="ghost" onClick={() => handleDeleteBrteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination Controls */}
                    {totalBrtePages > 1 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50/50">
                        <p className="text-xs text-gray-500 font-medium">
                          Showing <span className="font-semibold text-gray-800">{(currentBrtePage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
                          <span className="font-semibold text-gray-800">{Math.min(currentBrtePage * ITEMS_PER_PAGE, brteSessions.length)}</span> of{" "}
                          <span className="font-semibold text-gray-800">{brteSessions.length}</span> BRTE sessions
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentBrtePage === 1}
                            onClick={() => setBrtePage((p) => Math.max(1, p - 1))}
                            className="h-8 text-xs font-semibold"
                          >
                            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                          </Button>
                          <span className="text-xs font-semibold px-2 text-gray-700">
                            Page {currentBrtePage} of {totalBrtePages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={currentBrtePage >= totalBrtePages}
                            onClick={() => setBrtePage((p) => Math.min(totalBrtePages, p + 1))}
                            className="h-8 text-xs font-semibold"
                          >
                            Next <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: HM SESSIONS LIST ── */}
        {activeTab === "hm-sessions" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Headmasters (HM) Sessions
                </h2>
                <p className="text-sm text-gray-500">Manage HM meetings and export school attendance.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <Button
                  onClick={() => handleExportConsolidatedAttendance("HM")}
                  disabled={isExportingConsolidated || hmSessions.length === 0}
                  className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidated && exportMatrixSessionType === "HM" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export Master HM Matrix
                </Button>
                <Button onClick={() => setActiveTab("new-hm-session")} className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white w-full sm:w-auto gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule HM Session
                </Button>
              </div>
            </div>

            {/* Selection Action Bar */}
            {selectedHmSessionIds.length > 0 && (
              <div className="flex items-center justify-between p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                  <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">
                    {selectedHmSessionIds.length}
                  </div>
                  <span>HM Session(s) Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleDownloadSelectedHm}
                    disabled={isExportingSelectedHm}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs h-8 shadow-xs"
                  >
                    {isExportingSelectedHm ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Download Selected ({selectedHmSessionIds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedHmSessionIds([])}
                    className="text-xs text-gray-600 hover:text-gray-900 h-8"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {/* Mobile card list */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {hmSessions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No HM sessions yet. Click &quot;Schedule HM Session&quot; to create one.</p>
                  ) : paginatedHmSessions.map((s) => {
                    const isSelected = selectedHmSessionIds.includes(s.id);
                    const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                    const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                    return (
                      <div key={s.id} className={`px-4 py-3 space-y-2 ${isSelected ? "bg-indigo-50/50" : ""}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            aria-label="Select HM session"
                            checked={isSelected}
                            onChange={() => toggleSelectHmSession(s.id)}
                            className="w-4 h-4 mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{s.title}</p>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  {formattedTime && <span className="ml-1.5">{formattedTime}</span>}
                                </p>
                              </div>
                              {expired && <Badge variant="secondary" className="text-[10px] shrink-0">Ended</Badge>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              <Button size="sm" className="h-7 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                Export Excel
                              </Button>
                              {expired ? (
                                <span className="text-xs text-gray-500 font-medium">Link closed</span>
                              ) : (
                                <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                                  Open Meet <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-7 w-7 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <input
                            type="checkbox"
                            aria-label="Select all HM sessions on page"
                            checked={
                              paginatedHmSessions.length > 0 &&
                              paginatedHmSessions.every((s) => selectedHmSessionIds.includes(s.id))
                            }
                            onChange={() => toggleSelectAllHmSessions(paginatedHmSessions)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Date &amp; Time</TableHead>
                        <TableHead>Target Rules</TableHead>
                        <TableHead>Google Meet Link</TableHead>
                        <TableHead>Exports</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hmSessions.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No HM sessions scheduled yet.</TableCell></TableRow>
                      ) : paginatedHmSessions.map((s) => {
                        const isSelected = selectedHmSessionIds.includes(s.id);
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <TableRow key={s.id} className={isSelected ? "bg-indigo-50/40" : ""}>
                            <TableCell className="w-12 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Select session ${s.title}`}
                                checked={isSelected}
                                onChange={() => toggleSelectHmSession(s.id)}
                                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-semibold text-gray-900">
                              <div className="flex items-center gap-2"><span className="truncate max-w-[200px]">{s.title}</span>{expired && <Badge variant="secondary" className="text-[10px]">Ended</Badge>}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">{new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                              {formattedTime && <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formattedTime}</div>}
                            </TableCell>
                            <TableCell>
                              {(!s.categoryRules?.length && !s.schoolTypeRules?.length && !s.blockRules?.length) ? (
                                <Badge variant="secondary">All Schools</Badge>
                              ) : (
                                <div className="flex gap-1 flex-wrap max-w-[220px]">
                                  {s.categoryRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{r.categoryType.replace("_", " ")}</Badge>)}
                                  {s.schoolTypeRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.schoolType}</Badge>)}
                                  {s.blockRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{r.block}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {expired ? <span className="text-xs text-gray-500 font-medium">Link closed</span> : (
                                <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">Open Meet <ExternalLink className="w-3 h-3" /></a>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" className="h-8 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                Export Excel
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-8 w-8 text-gray-500"><Edit2 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalHmPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50/50">
                    <p className="text-xs text-gray-500 font-medium">
                      Showing <span className="font-semibold text-gray-800">{(currentHmPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
                      <span className="font-semibold text-gray-800">{Math.min(currentHmPage * ITEMS_PER_PAGE, hmSessions.length)}</span> of{" "}
                      <span className="font-semibold text-gray-800">{hmSessions.length}</span> HM sessions
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentHmPage === 1}
                        onClick={() => setHmPage((p) => Math.max(1, p - 1))}
                        className="h-8 text-xs font-semibold"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>
                      <span className="text-xs font-semibold px-2 text-gray-700">
                        Page {currentHmPage} of {totalHmPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentHmPage >= totalHmPages}
                        onClick={() => setHmPage((p) => Math.min(totalHmPages, p + 1))}
                        className="h-8 text-xs font-semibold"
                      >
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 3: CREATE NEW HM SESSION ── */}
        {activeTab === "new-hm-session" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
            <Card>
              <CardHeader className="border-b border-gray-200 bg-gray-50/80">
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  Schedule HM Session
                </CardTitle>
                <CardDescription>
                  Create a new training/review session for Headmasters/Principals with optional category, school type, and block targeting.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateHmSession} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">HM Session Title <span className="text-red-500">*</span></label>
                    <Input placeholder="e.g. High School HMs Review Meeting" value={hmTitle} onChange={(e) => setHmTitle(e.target.value)} required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Description</label>
                    <Input placeholder="Brief agenda or instructions" value={hmDescription} onChange={(e) => setHmDescription(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-sm font-semibold text-gray-700">Date <span className="text-red-500">*</span></label>
                      <Input type="date" value={hmSessionDate} onChange={(e) => setHmSessionDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Start Time</label>
                      <Input type="time" value={hmStartTime} onChange={(e) => setHmStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">End Time</label>
                      <Input type="time" value={hmEndTime} onChange={(e) => setHmEndTime(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Google Meet URL <span className="text-red-500">*</span></label>
                    <Input placeholder="https://meet.google.com/abc-defg-hij" value={hmGeneralMeetUrl} onChange={(e) => setHmGeneralMeetUrl(e.target.value)} required />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">1. Target School Category Types</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {CATEGORY_TYPE_OPTIONS.map((cat) => {
                          const isSelected = hmSelectedCategories.includes(cat.id);
                          return (
                            <div
                              key={cat.id}
                              onClick={() => {
                                if (isSelected) {
                                  setHmSelectedCategories(hmSelectedCategories.filter((c) => c !== cat.id));
                                } else {
                                  setHmSelectedCategories([...hmSelectedCategories, cat.id]);
                                }
                              }}
                              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3 ${
                                isSelected
                                  ? "bg-indigo-50 border-indigo-600 text-indigo-900"
                                  : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                              }`}
                            >
                              <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 bg-white"}`}>
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
                            const isSelected = hmSelectedSchoolTypes.includes(st);
                            return (
                              <div
                                key={st}
                                onClick={() => {
                                  if (isSelected) {
                                    setHmSelectedSchoolTypes(hmSelectedSchoolTypes.filter((s) => s !== st));
                                  } else {
                                    setHmSelectedSchoolTypes([...hmSelectedSchoolTypes, st]);
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
                            const isSelected = hmSelectedBlocks.includes(blk);
                            return (
                              <div
                                key={blk}
                                onClick={() => {
                                  if (isSelected) {
                                    setHmSelectedBlocks(hmSelectedBlocks.filter((b) => b !== blk));
                                  } else {
                                    setHmSelectedBlocks([...hmSelectedBlocks, blk]);
                                  }
                                }}
                                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                                  isSelected
                                    ? "bg-[hsl(213,45%,94%)] border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)]"
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
                      {hmSelectedCategories.length === 0 && hmSelectedSchoolTypes.length === 0 && hmSelectedBlocks.length === 0
                        ? "No filters selected. Session will be visible to ALL active schools."
                        : `Targeting: ${hmSelectedCategories.length > 0 ? `${hmSelectedCategories.length} Category Type(s)` : "All Categories"} AND ${hmSelectedSchoolTypes.length > 0 ? `${hmSelectedSchoolTypes.length} School Type(s)` : "All School Types"} AND ${hmSelectedBlocks.length > 0 ? `${hmSelectedBlocks.length} Block(s)` : "All Blocks"}.`}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isPending}>
                      {isPending ? "Creating..." : "Save HM Session"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 4: NMMS SESSIONS LIST ── */}
        {activeTab === "nmms-sessions" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Video className="w-5 h-5 text-blue-600" />
                  NMMS Training Sessions
                </h2>
                <p className="text-sm text-gray-500">Manage NMMS teacher training sessions and export attendance.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <Button
                  onClick={() => handleExportConsolidatedAttendance("NMMS")}
                  disabled={isExportingConsolidated || nmmsSessions.length === 0}
                  className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white font-bold gap-2 text-xs h-9 shadow-xs"
                >
                  {isExportingConsolidated && exportMatrixSessionType === "NMMS" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Export Master NMMS Matrix
                </Button>
                <Button onClick={() => setActiveTab("new-nmms-session")} className="w-full sm:w-auto gap-2 text-xs h-9">
                  <Plus className="w-4 h-4" /> Schedule NMMS Session
                </Button>
              </div>
            </div>

            {/* Selection Action Bar */}
            {selectedNmmsSessionIds.length > 0 && (
              <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 text-blue-950 font-bold text-sm">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                    {selectedNmmsSessionIds.length}
                  </div>
                  <span>NMMS Session(s) Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleDownloadSelectedNmms}
                    disabled={isExportingSelectedNmms}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 text-xs h-8 shadow-xs"
                  >
                    {isExportingSelectedNmms ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    Download Selected ({selectedNmmsSessionIds.length})
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedNmmsSessionIds([])}
                    className="text-xs text-gray-600 hover:text-gray-900 h-8"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
            )}

            <Card>
              <CardContent className="p-0">
                {/* Mobile card list */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {nmmsSessions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No NMMS sessions yet. Click &quot;Schedule NMMS Session&quot; to create one.</p>
                  ) : paginatedNmmsSessions.map((s) => {
                    const isSelected = selectedNmmsSessionIds.includes(s.id);
                    const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                    const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                    return (
                      <div key={s.id} className={`px-4 py-3 space-y-2 ${isSelected ? "bg-blue-50/50" : ""}`}>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            aria-label="Select NMMS session"
                            checked={isSelected}
                            onChange={() => toggleSelectNmmsSession(s.id)}
                            className="w-4 h-4 mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-semibold text-gray-900 text-sm truncate">{s.title}</p>
                                  {s.includeBrte && (
                                    <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                                      BRTEs Included
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  {formattedTime && <span className="ml-1.5">{formattedTime}</span>}
                                </p>
                              </div>
                              {expired && <Badge variant="secondary" className="text-[10px] shrink-0">Ended</Badge>}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              <Button size="sm" className="h-7 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                Export Excel
                              </Button>
                              {expired ? (
                                <span className="text-xs text-gray-500 font-medium">Link closed</span>
                              ) : (
                                <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                                  Open Meet <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-7 w-7 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">
                          <input
                            type="checkbox"
                            aria-label="Select all NMMS sessions on page"
                            checked={
                              paginatedNmmsSessions.length > 0 &&
                              paginatedNmmsSessions.every((s) => selectedNmmsSessionIds.includes(s.id))
                            }
                            onChange={() => toggleSelectAllNmmsSessions(paginatedNmmsSessions)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Date &amp; Time</TableHead>
                        <TableHead>Target Rules</TableHead>
                        <TableHead>Google Meet Link</TableHead>
                        <TableHead>Exports</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nmmsSessions.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No NMMS sessions scheduled yet.</TableCell></TableRow>
                      ) : paginatedNmmsSessions.map((s) => {
                        const isSelected = selectedNmmsSessionIds.includes(s.id);
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <TableRow key={s.id} className={isSelected ? "bg-blue-50/40" : ""}>
                            <TableCell className="w-12 text-center">
                              <input
                                type="checkbox"
                                aria-label={`Select session ${s.title}`}
                                checked={isSelected}
                                onChange={() => toggleSelectNmmsSession(s.id)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-semibold text-gray-900">
                              <div className="flex items-center gap-2">
                                <span className="truncate max-w-[200px]">{s.title}</span>
                                {s.includeBrte && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                                    BRTEs Included
                                  </Badge>
                                )}
                                {expired && <Badge variant="secondary" className="text-[10px]">Ended</Badge>}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">{new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                              {formattedTime && <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formattedTime}</div>}
                            </TableCell>
                            <TableCell>
                              {(!s.categoryRules?.length && !s.schoolTypeRules?.length && !s.blockRules?.length) ? (
                                <Badge variant="secondary">All Schools</Badge>
                              ) : (
                                <div className="flex gap-1 flex-wrap max-w-[220px]">
                                  {s.categoryRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{r.categoryType.replace("_", " ")}</Badge>)}
                                  {s.schoolTypeRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.schoolType}</Badge>)}
                                  {s.blockRules?.map((r: any) => <Badge key={r.id} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{r.block}</Badge>)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {expired ? <span className="text-xs text-gray-500 font-medium">Link closed</span> : (
                                <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">Open Meet <ExternalLink className="w-3 h-3" /></a>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" className="h-8 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100" onClick={() => handleExportSessionExcel(s.id, s.title)} disabled={exportingSessionId === s.id}>
                                {exportingSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                Export Excel
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditSession(s)} className="h-8 w-8 text-gray-500"><Edit2 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalNmmsPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50/50">
                    <p className="text-xs text-gray-500 font-medium">
                      Showing <span className="font-semibold text-gray-800">{(currentNmmsPage - 1) * ITEMS_PER_PAGE + 1}</span> to{" "}
                      <span className="font-semibold text-gray-800">{Math.min(currentNmmsPage * ITEMS_PER_PAGE, nmmsSessions.length)}</span> of{" "}
                      <span className="font-semibold text-gray-800">{nmmsSessions.length}</span> NMMS sessions
                    </p>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentNmmsPage === 1}
                        onClick={() => setNmmsPage((p) => Math.max(1, p - 1))}
                        className="h-8 text-xs font-semibold"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                      </Button>
                      <span className="text-xs font-semibold px-2 text-gray-700">
                        Page {currentNmmsPage} of {totalNmmsPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={currentNmmsPage >= totalNmmsPages}
                        onClick={() => setNmmsPage((p) => Math.min(totalNmmsPages, p + 1))}
                        className="h-8 text-xs font-semibold"
                      >
                        Next <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── TAB 5: CREATE NEW NMMS SESSION ── */}
        {activeTab === "new-nmms-session" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
            <Card>
              <CardHeader className="border-b border-gray-200 bg-gray-50/80">
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-blue-600" />
                  Schedule NMMS Session
                </CardTitle>
                <CardDescription>
                  Create a new training schedule and specify target school categories for NMMS teachers.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={handleCreateNmmsSession} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">NMMS Session Title <span className="text-red-500">*</span></label>
                    <Input placeholder="e.g. NMMS Coaching Session 1" value={nmmsTitle} onChange={(e) => setNmmsTitle(e.target.value)} required />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Description</label>
                    <Input placeholder="Brief agenda or instructions" value={nmmsDescription} onChange={(e) => setNmmsDescription(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-sm font-semibold text-gray-700">Date <span className="text-red-500">*</span></label>
                      <Input type="date" value={nmmsSessionDate} onChange={(e) => setNmmsSessionDate(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Start Time</label>
                      <Input type="time" value={nmmsStartTime} onChange={(e) => setNmmsStartTime(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">End Time</label>
                      <Input type="time" value={nmmsEndTime} onChange={(e) => setNmmsEndTime(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Google Meet URL <span className="text-red-500">*</span></label>
                    <Input placeholder="https://meet.google.com/abc-defg-hij" value={nmmsGeneralMeetUrl} onChange={(e) => setNmmsGeneralMeetUrl(e.target.value)} required />
                  </div>

                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-gray-700">1. Target School Category Types</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {CATEGORY_TYPE_OPTIONS.map((cat) => {
                          const isSelected = nmmsSelectedCategories.includes(cat.id);
                          return (
                            <div
                              key={cat.id}
                              onClick={() => {
                                if (isSelected) {
                                  setNmmsSelectedCategories(nmmsSelectedCategories.filter((c) => c !== cat.id));
                                } else {
                                  setNmmsSelectedCategories([...nmmsSelectedCategories, cat.id]);
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
                            const isSelected = nmmsSelectedSchoolTypes.includes(st);
                            return (
                              <div
                                key={st}
                                onClick={() => {
                                  if (isSelected) {
                                    setNmmsSelectedSchoolTypes(nmmsSelectedSchoolTypes.filter((s) => s !== st));
                                  } else {
                                    setNmmsSelectedSchoolTypes([...nmmsSelectedSchoolTypes, st]);
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
                            const isSelected = nmmsSelectedBlocks.includes(blk);
                            return (
                              <div
                                key={blk}
                                onClick={() => {
                                  if (isSelected) {
                                    setNmmsSelectedBlocks(nmmsSelectedBlocks.filter((b) => b !== blk));
                                  } else {
                                    setNmmsSelectedBlocks([...nmmsSelectedBlocks, blk]);
                                  }
                                }}
                                className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                                  isSelected
                                    ? "bg-[hsl(213,45%,94%)] border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)]"
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

                    <div className="space-y-2 pt-3 border-t border-gray-100">
                      <label className="text-sm font-semibold text-gray-700">4. Target BRTEs (Block Resource Teacher Educators)</label>
                      <div
                        onClick={() => setNmmsIncludeBrte(!nmmsIncludeBrte)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
                          nmmsIncludeBrte
                            ? "bg-amber-50/90 border-amber-500 text-amber-950 ring-1 ring-amber-500/20"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${nmmsIncludeBrte ? "border-amber-600 bg-amber-600 text-white" : "border-gray-300 bg-white"}`}>
                          {nmmsIncludeBrte && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs font-bold flex items-center gap-2">
                            <span>Add all BRTEs to this NMMS Session</span>
                            {nmmsIncludeBrte && (
                              <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0 border-amber-300">
                                Enabled
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 leading-relaxed">
                            When enabled, all BRTEs will receive this NMMS Google Meet link on their BRTE dashboard to join and record attendance.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 pt-1 space-y-1">
                      <p>
                        {nmmsSelectedCategories.length === 0 && nmmsSelectedSchoolTypes.length === 0 && nmmsSelectedBlocks.length === 0
                          ? "Schools: No filters selected. Session will be visible to ALL active schools."
                          : `Schools Targeting: ${nmmsSelectedCategories.length > 0 ? `${nmmsSelectedCategories.length} Category Type(s)` : "All Categories"} AND ${nmmsSelectedSchoolTypes.length > 0 ? `${nmmsSelectedSchoolTypes.length} School Type(s)` : "All School Types"} AND ${nmmsSelectedBlocks.length > 0 ? `${nmmsSelectedBlocks.length} Block(s)` : "All Blocks"}.`}
                      </p>
                      {nmmsIncludeBrte && (
                        <p className="text-amber-800 font-semibold flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
                          BRTEs: All BRTEs are included and will receive the Google Meet link.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" className="w-full" disabled={isPending}>
                      {isPending ? "Creating..." : "Save NMMS Session"}
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
                  className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white font-bold gap-2 text-xs h-9 shadow-xs"
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
                {/* Mobile card list */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {brteSessions.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No BRTE sessions yet. Click &quot;Schedule BRTE Session&quot; to create one.</p>
                  ) : brteSessions.map((s) => {
                    const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                    const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                    return (
                      <div key={s.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{s.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              {formattedTime && <span className="ml-1.5">{formattedTime}</span>}
                            </p>
                          </div>
                          {expired && <Badge variant="secondary" className="text-[10px] shrink-0">Ended</Badge>}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button size="sm" className="h-7 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100" onClick={() => handleExportBrteSessionExcel(s.id, s.title)} disabled={exportingBrteSessionId === s.id}>
                            {exportingBrteSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                            Export Excel
                          </Button>
                          {expired ? (
                            <span className="text-xs text-gray-500 font-medium">Link closed</span>
                          ) : (
                            <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">
                              Open Meet <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => openEditBrteSession(s)} className="h-7 w-7 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteBrteSession(s.id)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Date &amp; Time</TableHead>
                        <TableHead>Google Meet Link</TableHead>
                        <TableHead>Target Blocks</TableHead>
                        <TableHead>Exports</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brteSessions.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No BRTE sessions scheduled yet.</TableCell></TableRow>
                      ) : brteSessions.map((s) => {
                        const formattedTime = formatSessionTimeString(s.startTime, s.endTime);
                        const expired = isSessionExpired(s.sessionDate, s.endTime, s.startTime);
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-semibold text-gray-900">
                              <div className="flex items-center gap-2"><span className="truncate max-w-[200px]">{s.title}</span>{expired && <Badge variant="secondary" className="text-[10px]">Ended</Badge>}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">{new Date(s.sessionDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                              {formattedTime && <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" /> {formattedTime}</div>}
                            </TableCell>
                            <TableCell>
                              {expired ? <span className="text-xs text-gray-500 font-medium">Link closed</span> : (
                                <a href={s.generalMeetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold">Open Meet <ExternalLink className="w-3 h-3" /></a>
                              )}
                            </TableCell>
                            <TableCell>
                              {(!s.blockRules || s.blockRules.length === 0) ? <Badge variant="secondary">All BRTEs</Badge> : (
                                <div className="flex gap-1 flex-wrap max-w-[220px]">{s.blockRules.map((r: any) => <Badge key={r.id} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">{r.block}</Badge>)}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button size="sm" className="h-8 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100" onClick={() => handleExportBrteSessionExcel(s.id, s.title)} disabled={exportingBrteSessionId === s.id}>
                                {exportingBrteSessionId === s.id ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                                Export Excel
                              </Button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" onClick={() => openEditBrteSession(s)} className="h-8 w-8 text-gray-500"><Edit2 className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDeleteBrteSession(s.id)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
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

        {/* ── TAB 5: CREATE NEW BRTE SESSION ── */}
        {activeTab === "new-brte-session" && (
          <div className="max-w-2xl mx-auto space-y-6 animate-fade-up">
            <Card>
              <CardHeader className="border-b border-gray-200 bg-gray-50/80">
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
                {/* Mobile card list */}
                <div className="divide-y divide-gray-100 md:hidden">
                  {paginatedSchools.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-500">No schools match your search.</p>
                  ) : paginatedSchools.map((sc) => (
                    <div key={sc.udise} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{sc.name}</p>
                          <p className="text-xs font-mono text-[hsl(213,56%,24%)] mt-0.5">{sc.udise}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{sc.block ?? "—"} · {sc.management ?? "—"}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => setEditingSchool({ ...sc })} className="h-7 w-7 text-gray-500"><Edit2 className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteSchool(sc.udise)} className="h-7 w-7 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                      <select
                        value={sc.categoryType ?? ""}
                        onChange={(e) => handleQuickCategoryChange(sc.udise, e.target.value ? (e.target.value as CategoryType) : null)}
                        className="w-full h-8 rounded-md bg-white border border-gray-300 text-xs px-2 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[hsl(213,56%,24%)]"
                      >
                        <option value="">Unspecified</option>
                        {CATEGORY_TYPE_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
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
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-500">No schools match your search.</TableCell></TableRow>
                      ) : paginatedSchools.map((sc) => (
                        <TableRow key={sc.udise}>
                          <TableCell className="font-mono font-bold text-[hsl(213,56%,24%)]">{sc.udise}</TableCell>
                          <TableCell className="font-semibold text-gray-900 max-w-xs truncate">{sc.name}</TableCell>
                          <TableCell className="text-xs text-purple-800 font-medium max-w-[180px] truncate">{sc.management ?? "—"}</TableCell>
                          <TableCell className="text-gray-600 text-xs">{sc.block ?? "—"} / {sc.educationDistrict ?? "—"}</TableCell>
                          <TableCell>
                            <select
                              value={sc.categoryType ?? ""}
                              onChange={(e) => handleQuickCategoryChange(sc.udise, e.target.value ? (e.target.value as CategoryType) : null)}
                              className="h-8 rounded-md bg-white border border-gray-300 text-xs px-2 font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[hsl(213,56%,24%)]"
                            >
                              <option value="">Unspecified</option>
                              {CATEGORY_TYPE_OPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                            </select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => setEditingSchool({ ...sc })} className="h-8 w-8 text-gray-500"><Edit2 className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteSchool(sc.udise)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 py-4 border-t border-gray-200 bg-gray-50/50">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-bold text-gray-900">{filteredSchools.length === 0 ? 0 : (currentSchoolPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentSchoolPage * ITEMS_PER_PAGE, filteredSchools.length)}</span> of <span className="font-bold text-gray-900">{filteredSchools.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={currentSchoolPage <= 1} onClick={() => setSchoolPage((p) => p - 1)}>
                      <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                    </Button>
                    <span className="text-sm font-medium text-gray-600 px-2">Page {currentSchoolPage} of {totalSchoolPages}</span>
                    <Button size="sm" variant="outline" disabled={currentSchoolPage >= totalSchoolPages} onClick={() => setSchoolPage((p) => p + 1)}>
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
            <CardHeader className="border-b border-gray-200 bg-[hsl(213,56%,24%)] text-white flex flex-row items-center justify-between py-4 rounded-t-lg">
              <CardTitle className="text-lg text-white">Add School</CardTitle>
              <button onClick={() => setIsAddSchoolOpen(false)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
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
            <CardHeader className="border-b border-gray-200 bg-[hsl(213,56%,24%)] text-white flex flex-row items-center justify-between py-4 rounded-t-lg">
              <CardTitle className="text-lg text-white">Edit School</CardTitle>
              <button onClick={() => setEditingSchool(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
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

      {/* EDIT SESSION MODAL (HM / NMMS) */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] shadow-2xl border-0 flex flex-col overflow-hidden">
            <CardHeader className="border-b border-gray-200 bg-[hsl(213,56%,24%)] text-white flex flex-row items-center justify-between py-4 shrink-0 rounded-t-lg">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg text-white">
                  Edit {editingSession.sessionType === "HM" ? "HM" : "NMMS"} Session
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    editingSession.sessionType === "HM"
                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold"
                      : "bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold"
                  }
                >
                  {editingSession.sessionType === "HM" ? "HM Session" : "NMMS Session"}
                </Badge>
              </div>
              <button onClick={() => setEditingSession(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 pt-5 pb-2">
              <form id="edit-session-form" onSubmit={handleUpdateSession} className="space-y-4 text-sm">
                {/* Session Type */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-700">Session Type <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setEditingSession({ ...editingSession, sessionType: "HM" })}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                        editingSession.sessionType === "HM"
                          ? "bg-indigo-50 border-indigo-600 text-indigo-950 font-semibold shadow-xs"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        editingSession.sessionType === "HM" ? "border-indigo-600 bg-indigo-600 text-white" : "border-gray-300 bg-white"
                      }`}>
                        {editingSession.sessionType === "HM" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-950">HM Session</div>
                        <div className="text-[11px] text-gray-500 font-normal">Headmasters meeting</div>
                      </div>
                    </div>
                    <div
                      onClick={() => setEditingSession({ ...editingSession, sessionType: "NMMS" })}
                      className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-2.5 ${
                        editingSession.sessionType !== "HM"
                          ? "bg-blue-50 border-blue-600 text-blue-950 font-semibold shadow-xs"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                        editingSession.sessionType !== "HM" ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"
                      }`}>
                        {editingSession.sessionType !== "HM" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-blue-950">NMMS Session</div>
                        <div className="text-[11px] text-gray-500 font-normal">Teachers training meet</div>
                      </div>
                    </div>
                  </div>
                </div>

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

                  {/* BRTEs for NMMS sessions */}
                  {editingSession.sessionType !== "HM" && (
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <label className="text-xs font-semibold text-gray-700">4. Target BRTEs</label>
                      <div
                        onClick={() =>
                          setEditingSession({
                            ...editingSession,
                            includeBrte: !editingSession.includeBrte,
                          })
                        }
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 ${
                          editingSession.includeBrte
                            ? "bg-amber-50/90 border-amber-500 text-amber-950 ring-1 ring-amber-500/20"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            editingSession.includeBrte
                              ? "border-amber-600 bg-amber-600 text-white"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {editingSession.includeBrte && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="space-y-0.5">
                          <div className="text-xs font-semibold flex items-center gap-1.5">
                            <span>Add all BRTEs to this NMMS Session</span>
                            {editingSession.includeBrte && (
                              <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0 border-amber-300">
                                Enabled
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 leading-tight">
                            All BRTEs will receive the Google Meet link on their portal and can record attendance.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 pt-1">
                    {(!editingSession.categoryTypes?.length && !editingSession.schoolTypes?.length && !editingSession.blocks?.length)
                      ? "No school filters selected — session visible to ALL active teachers."
                      : `Targeting: ${editingSession.categoryTypes?.length ? `${editingSession.categoryTypes.length} Category Type(s)` : "All Categories"} AND ${editingSession.schoolTypes?.length ? `${editingSession.schoolTypes.length} School Type(s)` : "All School Types"} AND ${editingSession.blocks?.length ? `${editingSession.blocks.length} Block(s)` : "All Blocks"}.`}
                    {editingSession.includeBrte && " (All BRTEs Included)"}
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
            <CardHeader className="border-b border-gray-200 bg-[hsl(213,56%,24%)] text-white flex flex-row items-center justify-between py-4 shrink-0 rounded-t-lg">
              <CardTitle className="text-lg text-white">Edit BRTE Session</CardTitle>
              <button onClick={() => setEditingBrteSession(null)} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
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
            <CardHeader className="border-b border-gray-200 bg-[hsl(213,56%,24%)] text-white flex flex-row items-center justify-between py-4 px-6 shrink-0 rounded-t-lg">
              <div>
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <Download className="w-5 h-5 text-[hsl(40,80%,50%)]" /> Export Master Schools Matrix ({exportMatrixSessionType} Sessions)
                </CardTitle>
                <CardDescription className="text-xs text-white/70 mt-0.5">
                  Filter by Category Types, School Types, and Blocks before exporting {exportMatrixSessionType} session matrix.
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
                  className="h-8 text-xs font-semibold border-white/30 text-white hover:bg-white/10 bg-transparent"
                >
                  Select All Filters
                </Button>
                <button
                  onClick={() => setIsExportSchoolsMatrixOpen(false)}
                  className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
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
                    className="text-[11px] font-semibold text-[hsl(213,56%,24%)] hover:underline"
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
                            ? "bg-[hsl(213,45%,94%)] border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)] shadow-xs"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-[hsl(213,56%,24%)] bg-[hsl(213,56%,24%)] text-white" : "border-gray-300 bg-white"
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
                    className="text-[11px] font-semibold text-[hsl(213,56%,24%)] hover:underline"
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
                              ? "bg-[hsl(213,45%,94%)] border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)] shadow-xs"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-[hsl(213,56%,24%)] bg-[hsl(213,56%,24%)] text-white" : "border-gray-300 bg-white"
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
                    className="text-[11px] font-semibold text-[hsl(213,56%,24%)] hover:underline"
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
                              ? "bg-[hsl(213,45%,94%)] border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)] shadow-xs"
                              : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                              isSelected ? "border-[hsl(213,56%,24%)] bg-[hsl(213,56%,24%)] text-white" : "border-gray-300 bg-white"
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
                <div className="rounded-lg bg-[hsl(213,45%,94%)] border border-[hsl(213,45%,85%)] p-3 text-xs text-[hsl(213,56%,24%)] flex items-center gap-2">
                  <span>ℹ️ Select any option(s) to filter by strict intersection, or click <strong>&quot;Select All Filters&quot;</strong> to export all schools.</span>
                </div>
              ) : (
                <div className="rounded-lg bg-[hsl(213,45%,94%)] border border-[hsl(213,45%,85%)] p-3 text-xs text-[hsl(213,56%,24%)] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <span className="font-semibold text-[hsl(213,56%,24%)]">Strict Intersection (AND):</span>
                  <span className="font-medium text-[hsl(213,56%,30%)]">
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
                className="bg-[hsl(213,56%,24%)] hover:bg-[hsl(213,56%,30%)] text-white font-semibold gap-2 shadow-xs"
              >
                {isExportingConsolidated ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download {exportMatrixSessionType} Matrix (.xlsx)
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
