"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  loginWithUdiseAction,
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
} from "lucide-react";

type LoginMode = "teacher" | "brte" | "admin";

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<LoginMode>("teacher");
  const [udise, setUdise] = useState("");
  const [brteEmis, setBrteEmis] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const udiseRef = useRef<HTMLInputElement>(null);
  const brteRef = useRef<HTMLInputElement>(null);
  const adminPassRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (loginMode === "teacher") udiseRef.current?.focus();
    if (loginMode === "brte") brteRef.current?.focus();
    if (loginMode === "admin") adminPassRef.current?.focus();
  }, [loginMode]);

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
        } else {
          router.replace("/teacher/dashboard");
        }
      } catch (err: any) {
        console.error("[LOGIN ERROR]", err);
        setError("An unexpected error occurred. Please try again.");
      }
    });
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
                  onClick={() => { setLoginMode("teacher"); setError(""); }}
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
                  onClick={() => { setLoginMode("brte"); setError(""); }}
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
                  {loginMode === "teacher" ? "HM / Teacher's Login" : loginMode === "brte" ? "BRTE Sign In" : "Admin Sign In"}
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-[hsl(213,45%,94%)] text-[hsl(213,56%,24%)]">
                  {loginMode === "admin" ? "Authorized" : "Device Locked"}
                </Badge>
              </div>
              <CardDescription className="text-gray-500 font-normal text-sm mt-1.5">
                {loginMode === "teacher"
                  ? "Enter your 11-digit School UDISE code to continue. Note: Logging in restricts this device to this UDISE code today."
                  : loginMode === "brte"
                  ? "Enter your 8-digit BRTE EMIS ID to continue. Note: Logging in restricts this device to this EMIS ID today."
                  : "Enter the admin password to access the administrative dashboard."}
              </CardDescription>
            </div>

            <CardContent className="p-4 sm:p-6 bg-white">
              {loginMode === "teacher" ? (
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
