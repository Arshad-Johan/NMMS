"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendOtpAction, verifyOtpAction, adminPasswordLoginAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,
  Phone,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Lock,
  Edit2,
  UserCheck,
  ShieldAlert,
  Landmark
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
    <div className="flex min-h-screen bg-gray-50 text-gray-900 selection:bg-[hsl(213,56%,24%)] selection:text-white">
      {/* ── Left Hero Section (Desktop Only) ── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-white p-12 flex-col justify-between border-r border-gray-200">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-transparent pointer-events-none" />

        {/* Brand header */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-10 w-10 rounded bg-[hsl(213,56%,24%)] flex items-center justify-center text-white shadow-sm">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="font-semibold text-lg tracking-tight text-gray-900 leading-tight">
              NMMS Portal
            </div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              Attendance Portal
            </div>
          </div>
        </div>

        {/* Center Hero content */}
        <div className="relative z-10 my-auto max-w-md space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 leading-tight">
            National Means Cum Merit Scholarship Scheme
          </h1>
          <div className="h-1 w-12 bg-emerald-600 rounded" />
          <p className="text-gray-600 text-base font-normal leading-relaxed pt-2">
            Official portal for managing teacher training sessions, tracking attendance, and organizing the district directory for the NMMS programme.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs font-medium text-gray-500 flex justify-between uppercase tracking-wider">
          <span>Department of School Education</span>
          <span>Madurai District</span>
        </div>
      </div>

      {/* ── Right Form Section (Mobile & Desktop) ── */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 relative bg-gray-50">
        <div className="w-full max-w-md animate-fade-up">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-8 justify-center text-center">
            <div className="h-12 w-12 rounded bg-[hsl(213,56%,24%)] flex items-center justify-center text-white shadow-sm">
              <Landmark className="w-7 h-7" />
            </div>
            <div>
              <div className="font-bold text-xl tracking-tight text-gray-900">NMMS Portal</div>
              <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">Attendance Portal</div>
            </div>
          </div>

          <Card className="border-gray-200 bg-white shadow-lg shadow-gray-200/50 rounded-xl overflow-hidden">
            <div className="bg-gray-50/80 border-b border-gray-100 p-4 sm:p-6 pb-4">
              {/* Login Mode Selector Tabs */}
              <div className="grid grid-cols-2 p-1 gap-1 bg-gray-200/50 rounded-lg mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setLoginMode("teacher");
                    setStep("mobile");
                    setError("");
                  }}
                  className={`py-2 rounded-md transition-all flex items-center justify-center gap-1.5 text-xs font-semibold ${
                    loginMode === "teacher"
                      ? "bg-white text-[hsl(213,56%,24%)] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
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
                  className={`py-2 rounded-md transition-all flex items-center justify-center gap-1.5 text-xs font-semibold ${
                    loginMode === "admin"
                      ? "bg-white text-[hsl(213,56%,24%)] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Admin Portal
                </button>
              </div>

              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-bold tracking-tight text-gray-900">
                  {loginMode === "teacher" ? "Teacher Sign In" : "Admin Sign In"}
                </CardTitle>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                  {loginMode === "teacher" ? "Secure OTP" : "Authorized"}
                </Badge>
              </div>
              <CardDescription className="text-gray-500 font-normal text-sm mt-1.5">
                {loginMode === "teacher"
                  ? step === "mobile"
                    ? "Enter your 10-digit registered mobile number to continue"
                    : "Enter the 6-digit OTP sent to your mobile"
                  : "Sign in with test mobile 6379931029 via OTP or use admin credentials"}
              </CardDescription>
            </div>

            <CardContent className="p-4 sm:p-6 bg-white">
              {loginMode === "teacher" || step === "otp" ? (
                /* Mobile OTP Flow (Works for Teacher or Admin) */
                step === "mobile" ? (
                  <form onSubmit={handleSendOtp} className="space-y-5" noValidate>
                    <div className="space-y-1.5">
                      <label htmlFor="mobile-input" className="text-xs font-semibold text-gray-700">
                        Mobile Number
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 font-medium text-gray-500 pointer-events-none">
                          +91
                        </div>
                        <Input
                          ref={mobileRef}
                          id="mobile-input"
                          type="tel"
                          inputMode="numeric"
                          placeholder="00000 00000"
                          value={mobile}
                          onChange={(e) => {
                            setError("");
                            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                          }}
                          maxLength={10}
                          className="pl-12 font-medium text-base h-11 bg-white border-gray-300"
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 text-sm font-semibold mt-2"
                      disabled={isPending || mobile.length < 10}
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin-slow" />
                          Sending OTP...
                        </>
                      ) : (
                        <>
                          Request OTP
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyOtp} className="space-y-5" noValidate>
                    <div className="flex items-center justify-between p-3 rounded bg-gray-50 border border-gray-200">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>+91 {mobile}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleEditNumber}
                        className="h-7 px-2 text-xs text-[hsl(213,56%,24%)] font-medium"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Change
                      </Button>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-semibold text-gray-700">
                        One-Time Password
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
                            className="h-10 sm:h-12 text-center text-base sm:text-lg font-semibold bg-white border-gray-300 focus:border-[hsl(213,56%,24%)] px-0"
                          />
                        ))}
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{error}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      className="w-full h-11 text-sm font-semibold mt-4"
                      disabled={isPending || otp.join("").length < 6}
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin-slow" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify & Proceed
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-between text-xs pt-2">
                      <span className="text-gray-500">Didn't receive the OTP?</span>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resendTimer > 0 || isPending}
                        className={`font-semibold transition-colors ${
                          resendTimer > 0 || isPending
                            ? "text-gray-400 cursor-not-allowed"
                            : "text-[hsl(213,56%,24%)] hover:text-blue-800"
                        }`}
                      >
                        {resendTimer > 0 ? `Resend in ${resendTimer}s` : "Resend Now"}
                      </button>
                    </div>
                  </form>
                )
              ) : (
                /* Admin Password Form */
                <form onSubmit={handleAdminPasswordLogin} className="space-y-4" noValidate>
                  <div className="space-y-1.5">
                    <label htmlFor="admin-email" className="text-xs font-semibold text-gray-700">
                      Email Address
                    </label>
                    <Input
                      id="admin-email"
                      type="email"
                      placeholder="admin@nmms.local"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="h-11 border-gray-300"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="admin-pass" className="text-xs font-semibold text-gray-700">
                      Password
                    </label>
                    <Input
                      id="admin-pass"
                      type="password"
                      placeholder="••••••••"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="h-11 border-gray-300"
                      required
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button type="submit" className="w-full h-11 text-sm font-semibold mt-2" disabled={isPending}>
                    {isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin-slow" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Secure Login
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
