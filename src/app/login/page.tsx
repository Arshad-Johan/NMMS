"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  loginWithUdiseAction,
  completeHosRegistrationAction,
  adminPasswordLoginAction,
  loginWithBrteAction,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Lock,
  School,
  ShieldAlert,
  Landmark,
  BookOpen,
  Phone,
  User,
  CheckCircle2,
  Building,
} from "lucide-react";

type LoginMode = "teacher" | "brte" | "admin";

const HOS_TYPE_OPTIONS = [
  { value: "Head_Master_Principal", label: "Head Master / Principal" },
  { value: "Acting_Head_Teacher", label: "Acting Head Teacher" },
  { value: "Asst_Head_Master_Vice_Principal", label: "Asst. Head Master / Vice Principal" },
  { value: "Incharge_from_other_school", label: "Incharge from other school" },
  { value: "Incharge_from_Block_District", label: "Incharge from Block / District" },
  { value: "Others", label: "Others" },
];

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<LoginMode>("teacher");
  const [udise, setUdise] = useState("");
  const [brteEmis, setBrteEmis] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  // One-time HM / Incharge registration state
  const [needsHosSetup, setNeedsHosSetup] = useState(false);
  const [hosSchool, setHosSchool] = useState<{
    udise: string;
    name: string;
    block?: string | null;
    educationDistrict?: string | null;
  } | null>(null);

  const [hosName, setHosName] = useState("");
  const [confirmHosName, setConfirmHosName] = useState("");
  const [hosPhone, setHosPhone] = useState("");
  const [confirmHosPhone, setConfirmHosPhone] = useState("");
  const [hosType, setHosType] = useState("Head_Master_Principal");

  const udiseRef = useRef<HTMLInputElement>(null);
  const brteRef = useRef<HTMLInputElement>(null);
  const adminPassRef = useRef<HTMLInputElement>(null);
  const hosNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (needsHosSetup) {
      hosNameRef.current?.focus();
    } else {
      if (loginMode === "teacher") udiseRef.current?.focus();
      if (loginMode === "brte") brteRef.current?.focus();
      if (loginMode === "admin") adminPassRef.current?.focus();
    }
  }, [loginMode, needsHosSetup]);

  function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleaned = udise.trim().replace(/\D/g, "");
    if (!cleaned || cleaned.length < 8 || cleaned.length > 11) {
      setError("Please enter a valid 11-digit UDISE code.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await loginWithUdiseAction(cleaned);
        if (res?.error) {
          setError(res.error);
        } else if (res?.needsHosSetup && res.school) {
          setHosSchool(res.school);
          setNeedsHosSetup(true);
          setError("");
        } else {
          router.replace("/teacher/dashboard");
        }
      } catch (err: any) {
        console.error("[LOGIN ERROR]", err);
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  function handleHosSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!hosSchool) {
      setError("School session expired. Please enter UDISE code again.");
      setNeedsHosSetup(false);
      return;
    }

    const trimmedName = hosName.trim();
    const trimmedConfirmName = confirmHosName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Please enter the HM / Incharge name.");
      return;
    }
    if (!trimmedConfirmName) {
      setError("Please reconfirm the HM / Incharge name by retyping it.");
      return;
    }
    if (trimmedName.toLowerCase() !== trimmedConfirmName.toLowerCase()) {
      setError("HM / Incharge name and confirmation name do not match. Please retype accurately to reconfirm.");
      return;
    }

    const cleanedPhone = hosPhone.trim().replace(/\D/g, "");
    const cleanedConfirmPhone = confirmHosPhone.trim().replace(/\D/g, "");
    if (!cleanedPhone || cleanedPhone.length !== 10) {
      setError("Please enter a valid 10-digit mobile phone number.");
      return;
    }
    if (!cleanedConfirmPhone) {
      setError("Please reconfirm the mobile phone number by retyping it.");
      return;
    }
    if (cleanedPhone !== cleanedConfirmPhone) {
      setError("Phone number and confirmation phone number do not match. Please retype accurately to reconfirm.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await completeHosRegistrationAction({
          udise: hosSchool.udise,
          name: trimmedName,
          confirmName: trimmedConfirmName,
          mobile: cleanedPhone,
          confirmMobile: cleanedConfirmPhone,
          hosType,
        });

        if (res?.error) {
          setError(res.error);
        } else {
          router.replace("/teacher/dashboard");
        }
      } catch (err: any) {
        console.error("[HOS REGISTRATION ERROR]", err);
        setError("An unexpected error occurred while saving details. Please try again.");
      }
    });
  }

  function handleResetHosSetup() {
    setError("");
    setNeedsHosSetup(false);
    setHosSchool(null);
    setHosName("");
    setConfirmHosName("");
    setHosPhone("");
    setConfirmHosPhone("");
  }

  function handleBrteLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const cleaned = brteEmis.trim().replace(/\D/g, "");
    if (!cleaned || cleaned.length !== 8) {
      setError("Please enter a valid 8-digit BRTE EMIS ID.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await loginWithBrteAction(cleaned);
        if (res?.error) {
          setError(res.error);
        } else {
          router.replace("/brte/dashboard");
        }
      } catch (err: any) {
        console.error("[BRTE LOGIN ERROR]", err);
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  function handleAdminPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!adminPassword) {
      setError("Please enter the admin password.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await adminPasswordLoginAction(adminPassword);
        if (res?.error) {
          setError(res.error);
        } else {
          router.replace("/admin/dashboard");
        }
      } catch (err: any) {
        console.error("[ADMIN LOGIN ERROR]", err);
        setError("An unexpected error occurred. Please try again.");
      }
    });
  }

  return (
    <div className="flex min-h-screen text-gray-900 selection:bg-[hsl(213,56%,24%)] selection:text-white">
      {/* ── Left Hero Section (Desktop Only) ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[hsl(213,56%,24%)] p-12 flex-col justify-between">
        {/* Gold accent stripe */}
        <div className="absolute top-0 left-0 w-full h-1 bg-[hsl(40,80%,50%)]" />
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-white/10 flex items-center justify-center text-white backdrop-blur-sm">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="font-extrabold text-xl tracking-tight text-white leading-tight">
              CEO - Madurai
            </div>
            <div className="text-xs font-bold text-[hsl(40,80%,50%)] tracking-wider uppercase">
              Gmeet Attendance Portal
            </div>
          </div>
        </div>

        {/* Center Hero content */}
        <div className="relative z-10 my-auto max-w-md space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
            Gmeet Attendance Portal
          </h1>
          <div className="h-1 w-16 bg-[hsl(40,80%,50%)] rounded-full" />
          <p className="text-white/70 text-base font-medium leading-relaxed pt-2">
            Official portal for managing training sessions, tracking attendance, and organizing directory records across Madurai district.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs font-semibold text-white/50 flex justify-between uppercase tracking-wider">
          <span>Department of School Education</span>
          <span>Madurai District</span>
        </div>
      </div>

      {/* ── Right Form Section (Mobile & Desktop) ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative bg-[hsl(220,14%,96%)]">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8 justify-center text-center">
            <div className="h-12 w-12 rounded-lg bg-[hsl(213,56%,24%)] flex items-center justify-center text-white shadow-md">
              <Landmark className="w-7 h-7" />
            </div>
            <div className="h-0.5 w-8 bg-[hsl(40,80%,50%)] rounded-full mt-1" />
            <div>
              <div className="font-extrabold text-xl tracking-tight text-gray-900">CEO - Madurai</div>
              <div className="text-xs font-bold text-[hsl(213,56%,24%)] uppercase tracking-wider">Gmeet Attendance Portal</div>
            </div>
          </div>

          <Card className="border-gray-200 bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="bg-white border-b border-gray-200 p-4 sm:p-6 pb-4">
              {/* Login Mode Selector Tabs — underline style */}
              <div className="flex border-b border-gray-200 mb-5 -mx-4 sm:-mx-6 px-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("teacher");
                    setError("");
                    if (needsHosSetup) handleResetHosSetup();
                  }}
                  className={`pb-3 mr-6 transition-all flex items-center gap-1.5 text-xs font-bold border-b-2 ${
                    loginMode === "teacher"
                      ? "border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <School className="w-3.5 h-3.5" />
                  HM / Teacher&apos;s Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("brte");
                    setError("");
                    if (needsHosSetup) handleResetHosSetup();
                  }}
                  className={`pb-3 transition-all flex items-center gap-1.5 text-xs font-bold border-b-2 ${
                    loginMode === "brte"
                      ? "border-[hsl(213,56%,24%)] text-[hsl(213,56%,24%)]"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  BRTE
                </button>
              </div>

              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold tracking-tight text-gray-900">
                  {needsHosSetup
                    ? "HM / Incharge Details"
                    : loginMode === "teacher"
                    ? "HM / Teacher's Login"
                    : loginMode === "brte"
                    ? "BRTE Sign In"
                    : "Admin Sign In"}
                </CardTitle>
                <Badge
                  variant="secondary"
                  className={`text-[10px] uppercase font-bold tracking-wider ${
                    needsHosSetup
                      ? "bg-amber-100 text-amber-900"
                      : "bg-[hsl(213,45%,94%)] text-[hsl(213,56%,24%)]"
                  }`}
                >
                  {needsHosSetup
                    ? "Required Once"
                    : loginMode === "admin"
                    ? "Authorized"
                    : "Device Locked"}
                </Badge>
              </div>
              <CardDescription className="text-gray-500 font-normal text-sm mt-1.5">
                {needsHosSetup
                  ? "First-time login verification. Provide and reconfirm the Headmaster / Incharge name and mobile number to sign in."
                  : loginMode === "teacher"
                  ? "Enter your 11-digit School UDISE code to continue. Note: Logging in restricts this device to this UDISE code today."
                  : loginMode === "brte"
                  ? "Enter your 8-digit BRTE EMIS ID to continue. Note: Logging in restricts this device to this EMIS ID today."
                  : "Enter the admin password to access the administrative dashboard."}
              </CardDescription>
            </div>

            <CardContent className="p-4 sm:p-6 bg-white">
              {loginMode === "teacher" ? (
                needsHosSetup && hosSchool ? (
                  /* HM / Incharge Setup Flow */
                  <form onSubmit={handleHosSubmit} className="space-y-4" noValidate>
                    {/* School summary card */}
                    <div className="bg-[hsl(213,45%,97%)] border border-[hsl(213,45%,85%)] rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(213,56%,24%)] flex items-center gap-1">
                          <Building className="w-3 h-3 text-[hsl(213,56%,24%)]" /> School Identified
                        </span>
                        <Badge className="font-mono text-[10px] bg-[hsl(213,56%,24%)] text-white">
                          UDISE: {hosSchool.udise}
                        </Badge>
                      </div>
                      <div className="font-bold text-sm text-gray-900 leading-snug">
                        {hosSchool.name}
                      </div>
                      {(hosSchool.block || hosSchool.educationDistrict) && (
                        <div className="text-xs text-gray-500 font-medium">
                          {[hosSchool.block, hosSchool.educationDistrict].filter(Boolean).join(" • ")}
                        </div>
                      )}
                    </div>

                    {/* Notice */}
                    <div className="p-2.5 rounded-md bg-amber-50/90 border border-amber-200 text-amber-900 text-xs">
                      <p className="font-semibold">Mandatory School Profile:</p>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Please enter and reconfirm the name and phone number. This prompt appears only once per UDISE code.
                      </p>
                    </div>

                    {/* Designation / Role */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Designation / Role
                      </label>
                      <select
                        value={hosType}
                        onChange={(e) => setHosType(e.target.value)}
                        className="w-full h-10 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[hsl(213,56%,24%)] font-medium"
                      >
                        {HOS_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* HM / Incharge Name */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        HM / Incharge Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <User className="absolute left-3 w-4 h-4 text-gray-400" />
                        <Input
                          ref={hosNameRef}
                          type="text"
                          placeholder="e.g. S. Ramanathan"
                          value={hosName}
                          onChange={(e) => {
                            setError("");
                            setHosName(e.target.value);
                          }}
                          className="pl-9 h-10 text-sm font-medium"
                          required
                        />
                      </div>
                    </div>

                    {/* Reconfirm HM / Incharge Name */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Reconfirm Name <span className="text-red-500">*</span>
                        </label>
                        {confirmHosName && (
                          <span
                            className={`text-[11px] font-medium flex items-center gap-1 ${
                              hosName.trim().toLowerCase() === confirmHosName.trim().toLowerCase()
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {hosName.trim().toLowerCase() === confirmHosName.trim().toLowerCase() ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Names match
                              </>
                            ) : (
                              "Retype name to match"
                            )}
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <User className="absolute left-3 w-4 h-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Retype exact name to reconfirm"
                          value={confirmHosName}
                          onChange={(e) => {
                            setError("");
                            setConfirmHosName(e.target.value);
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            setError("For verification, please type the name manually to reconfirm.");
                          }}
                          className="pl-9 h-10 text-sm font-medium"
                          required
                        />
                      </div>
                    </div>

                    {/* HM / Incharge Phone */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Mobile Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative flex items-center">
                        <Phone className="absolute left-3 w-4 h-4 text-gray-400" />
                        <Input
                          type="tel"
                          inputMode="numeric"
                          placeholder="10-digit mobile number"
                          maxLength={10}
                          value={hosPhone}
                          onChange={(e) => {
                            setError("");
                            setHosPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                          }}
                          className="pl-9 h-10 text-sm font-medium tracking-wide"
                          required
                        />
                      </div>
                    </div>

                    {/* Reconfirm Phone */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Reconfirm Mobile Number <span className="text-red-500">*</span>
                        </label>
                        {confirmHosPhone && (
                          <span
                            className={`text-[11px] font-medium flex items-center gap-1 ${
                              hosPhone.trim() === confirmHosPhone.trim() && hosPhone.trim().length === 10
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {hosPhone.trim() === confirmHosPhone.trim() && hosPhone.trim().length === 10 ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" /> Numbers match
                              </>
                            ) : (
                              "Retype number to match"
                            )}
                          </span>
                        )}
                      </div>
                      <div className="relative flex items-center">
                        <Phone className="absolute left-3 w-4 h-4 text-gray-400" />
                        <Input
                          type="tel"
                          inputMode="numeric"
                          placeholder="Retype 10-digit mobile number"
                          maxLength={10}
                          value={confirmHosPhone}
                          onChange={(e) => {
                            setError("");
                            setConfirmHosPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            setError("For verification, please type the phone number manually to reconfirm.");
                          }}
                          className="pl-9 h-10 text-sm font-medium tracking-wide"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 text-sm font-semibold mt-2"
                      disabled={
                        isPending ||
                        !hosName.trim() ||
                        !confirmHosName.trim() ||
                        hosPhone.trim().length !== 10 ||
                        confirmHosPhone.trim().length !== 10
                      }
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin-slow" />
                          Registering &amp; Signing in...
                        </>
                      ) : (
                        <>
                          Verify Details &amp; Sign In
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>

                    <button
                      type="button"
                      onClick={handleResetHosSetup}
                      className="w-full text-center text-xs text-gray-500 hover:text-gray-800 font-semibold pt-1 transition-colors"
                    >
                      ← Re-enter UDISE Code
                    </button>
                  </form>
                ) : (
                  /* UDISE Flow */
                  <form onSubmit={handleLoginSubmit} className="space-y-5" noValidate>
                    <div className="space-y-1.5">
                      <label htmlFor="udise-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        School UDISE Code
                      </label>
                      <div className="relative flex items-center">
                        <Input
                          ref={udiseRef}
                          id="udise-input"
                          type="tel"
                          inputMode="numeric"
                          placeholder="e.g. 33240100101"
                          value={udise}
                          onChange={(e) => {
                            setError("");
                            setUdise(e.target.value.replace(/\D/g, "").slice(0, 11));
                          }}
                          maxLength={11}
                          className="font-medium text-base h-11 bg-white border-gray-300 tracking-wider"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 text-sm font-semibold mt-2"
                      disabled={isPending || udise.trim().length < 8}
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin-slow" />
                          Logging in...
                        </>
                      ) : (
                        <>
                          Sign In
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </form>
                )
              ) : loginMode === "brte" ? (
                /* BRTE EMIS ID Flow */
                <form onSubmit={handleBrteLoginSubmit} className="space-y-5" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="brte-emis-input" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      BRTE EMIS ID
                    </label>
                    <div className="relative flex items-center">
                      <Input
                        ref={brteRef}
                        id="brte-emis-input"
                        type="tel"
                        inputMode="numeric"
                        placeholder="e.g. 30642579"
                        value={brteEmis}
                        onChange={(e) => {
                          setError("");
                          setBrteEmis(e.target.value.replace(/\D/g, "").slice(0, 8));
                        }}
                        maxLength={8}
                        className="font-medium text-base h-11 bg-white border-gray-300 tracking-wider"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 text-sm font-semibold mt-2"
                    disabled={isPending || brteEmis.trim().length !== 8}
                  >
                    {isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin-slow" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                /* Admin Password Form */
                <form onSubmit={handleAdminPasswordLogin} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="admin-pass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Admin Password
                    </label>
                    <Input
                      ref={adminPassRef}
                      id="admin-pass"
                      type="password"
                      placeholder="Enter admin password"
                      value={adminPassword}
                      onChange={(e) => {
                        setError("");
                        setAdminPassword(e.target.value);
                      }}
                      className="h-11 border-gray-300 font-medium"
                      required
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2" disabled={isPending || !adminPassword.trim()}>
                    {isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin-slow" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Sign In as Admin
                        <Lock className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      setLoginMode("teacher");
                    }}
                    className="w-full text-center text-xs text-gray-500 hover:text-gray-800 font-semibold pt-1 transition-colors"
                  >
                    ← Back to Teacher / BRTE Login
                  </button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Discreet Admin Login Button (When on UDISE/BRTE mode) */}
          {loginMode !== "admin" && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setLoginMode("admin");
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 bg-white hover:bg-white border border-gray-300 px-3 py-1.5 rounded-md shadow-xs transition-all"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-gray-400" />
                Admin Portal Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
