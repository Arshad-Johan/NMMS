"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendOtpAction, verifyOtpAction, adminPasswordLoginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap,
  Phone,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Lock,
  Edit2,
  UserCheck,
  ShieldAlert
} from "lucide-react";

type Step = "mobile" | "otp";
type LoginMode = "teacher" | "admin";

const OTP_RESEND_SECONDS = 30;

export default function LoginPage() {
  const router = useRouter();
  const [loginMode, setLoginMode] = useState<LoginMode>("teacher");
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [adminEmail, setAdminEmail] = useState("admin@nmms.local");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [resendTimer, setResendTimer] = useState(0);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const mobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    mobileRef.current?.focus();
  }, [loginMode, step]);

  useEffect(() => {
    if (step === "otp") {
      setTimeout(() => otpRefs.current[0]?.focus(), 50);
      startResendTimer();
    }
  }, [step]);

  function startResendTimer() {
    setResendTimer(OTP_RESEND_SECONDS);
  }

  useEffect(() => {
    if (resendTimer <= 0) return;
    const id = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [resendTimer]);

  function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await sendOtpAction(mobile);
      if (res.error) {
        setError(res.error);
      } else {
        setOtp(Array(6).fill(""));
        setStep("otp");
      }
    });
  }

  function handleResendOtp() {
    if (resendTimer > 0 || isPending) return;
    setError("");
    setOtp(Array(6).fill(""));
    startTransition(async () => {
      const res = await sendOtpAction(mobile);
      if (res.error) {
        setError(res.error);
      } else {
        startResendTimer();
      }
    });
  }

  function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const code = otp.join("");
    if (code.length < 6) {
      setError("Enter the complete 6-digit OTP.");
      return;
    }
    startTransition(async () => {
      const res = await verifyOtpAction(mobile, code, loginMode);
      if (res.error) {
        setError(res.error);
        setOtp(Array(6).fill(""));
        setTimeout(() => otpRefs.current[0]?.focus(), 50);
      } else {
        if (res.role === "admin") {
          router.replace("/admin/dashboard");
        } else {
          router.replace("/teacher/dashboard");
        }
      }
    });
  }

  function handleAdminPasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!adminEmail || !adminPassword) {
      setError("Please enter both email and password.");
      return;
    }
    startTransition(async () => {
      const res = await adminPasswordLoginAction(adminEmail, adminPassword);
      if (res.error) {
        setError(res.error);
      } else {
        router.replace("/admin/dashboard");
      }
    });
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        const next = [...otp];
        next[index - 1] = "";
        setOtp(next);
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...otp];
    pasted.split("").forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setOtp(next);
    const nextEmpty = next.findIndex((v) => !v);
    otpRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus();
  }

  function handleEditNumber() {
    setStep("mobile");
    setError("");
    setOtp(Array(6).fill(""));
    setTimeout(() => mobileRef.current?.focus(), 50);
  }

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* ── Left Hero Section (Desktop Only) ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-slate-900/60 p-12 flex-col justify-between border-r border-slate-800/80">
        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-base tracking-tight text-white">
              NMMS Portal
            </div>
            <div className="text-xs text-slate-400 font-normal">
              Department of School Education, Tamil Nadu
            </div>
          </div>
        </div>

        {/* Center Hero content */}
        <div className="relative z-10 my-auto max-w-lg space-y-3">
          <h1 className="text-xl font-semibold tracking-normal text-slate-200 leading-relaxed">
            National Means Cum Merit Scholarship Scheme
          </h1>
          
          <p className="text-slate-400 text-sm font-normal leading-relaxed">
            Attendance verification, Google Meet session links, and district directory management portal.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-500 font-normal flex justify-between">
          <span>School Education Department</span>
          <span>Tamil Nadu</span>
        </div>
      </div>

      {/* ── Right Form Section (Mobile & Desktop) ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative bg-slate-950">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6 justify-center">
            <div className="h-9 w-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">NMMS Portal</span>
          </div>

          <Card className="border-slate-800 bg-slate-900/90 shadow-xl">
            <CardHeader className="space-y-3 pb-6 px-4 sm:px-6">
              {/* Login Mode Selector Tabs */}
              <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("teacher");
                    setStep("mobile");
                    setError("");
                  }}
                  className={`py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                    loginMode === "teacher"
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Teacher Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("admin");
                    setStep("mobile");
                    setError("");
                  }}
                  className={`py-2 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                    loginMode === "admin"
                      ? "bg-indigo-600 text-white shadow-sm font-semibold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Admin Portal
                </button>
              </div>

              <div className="flex justify-between items-center pt-1">
                <CardTitle className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                  {loginMode === "teacher" ? "Teacher Portal" : "Admin Portal Login"}
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-normal">
                  {loginMode === "teacher" ? "Mobile OTP" : "Admin Auth"}
                </Badge>
              </div>
              <CardDescription className="text-slate-400 font-normal text-xs sm:text-sm">
                {loginMode === "teacher"
                  ? step === "mobile"
                    ? "Enter your 10-digit registered mobile number"
                    : "Enter the 6-digit OTP sent to your mobile"
                  : "Sign in with test mobile 6379931029 via OTP or admin credentials"}
              </CardDescription>
            </CardHeader>

            <CardContent className="px-4 sm:px-6">
              {loginMode === "teacher" || step === "otp" ? (
                /* Mobile OTP Flow (Works for Teacher or Admin) */
                step === "mobile" ? (
                  <form onSubmit={handleSendOtp} className="space-y-5" noValidate>
                    <div className="space-y-2">
                      <label htmlFor="mobile-input" className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Registered Mobile Number
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 text-sm font-medium text-slate-400 pointer-events-none border-r border-slate-800 pr-2.5">
                          +91
                        </div>
                        <Input
                          ref={mobileRef}
                          id="mobile-input"
                          type="tel"
                          inputMode="numeric"
                          placeholder="Enter 10-digit number"
                          value={mobile}
                          onChange={(e) => {
                            setError("");
                            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                          }}
                          maxLength={10}
                          className="pl-16 font-mono text-base tracking-wider"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isPending || mobile.length < 10}
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin-slow" />
                          Sending OTP...
                        </>
                      ) : (
                        <>
                          Send OTP
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                        <Phone className="w-4 h-4 text-indigo-400" />
                        <span className="font-mono">+91 {mobile}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleEditNumber}
                        className="h-7 px-2 text-xs text-indigo-400 hover:text-indigo-300"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        Enter 6-Digit OTP
                      </label>
                      <div className="grid grid-cols-6 gap-1.5 sm:gap-2" onPaste={handleOtpPaste}>
                        {otp.map((digit, i) => (
                          <Input
                            key={i}
                            ref={(el) => { otpRefs.current[i] = el; }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(i, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(i, e)}
                            className="h-11 sm:h-12 text-center text-base sm:text-lg font-semibold font-mono px-0 focus:border-indigo-500 focus:ring-indigo-500"
                          />
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11"
                      disabled={isPending || otp.join("").length < 6}
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin-slow" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify & Sign In
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-400">Didn't get the code?</span>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendTimer > 0 || isPending}
                        className={`font-medium transition-colors ${
                          resendTimer > 0 || isPending
                            ? "text-slate-500 cursor-not-allowed"
                            : "text-indigo-400 hover:text-indigo-300"
                        }`}
                      >
                        {resendTimer > 0 ? `Resend code in ${resendTimer}s` : "Resend OTP"}
                      </button>
                    </div>
                  </form>
                )
              ) : (
                /* Admin Password Form */
                <form onSubmit={handleAdminPasswordLogin} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="admin-email" className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      Admin Email Address
                    </label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@nmms.local"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="admin-pass" className="text-xs font-medium uppercase tracking-wider text-slate-400">
                      Password
                    </label>
                    <Input
                      id="admin-pass"
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full h-11" disabled={isPending}>
                    {isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin-slow" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Sign In as Administrator
                        <Lock className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
