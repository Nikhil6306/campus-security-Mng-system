"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, RefreshCw, Shield } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { LogoMark, SYSTEM_NAME, UNIVERSITY_NAME } from "@/components/shared/logo";
import { validateEmail } from "@/lib/validation";

type Step = "email" | "otp" | "password" | "done";

const RESEND_COOLDOWN_SECONDS = 60;

export function ForgotPasswordScreen() {
  const { forgotPassword, verifyOtp, resendOtp, resetPassword } = useAuth();

  // ── State ──────────────────────────────────────────────────────────
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [recoveryToken, setRecoveryToken] = React.useState<string | undefined>();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  // Resend cooldown timer
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const cooldownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = React.useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  React.useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Step 1: Email ───────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailErr = validateEmail(email);
    if (emailErr) { setError(emailErr); return; }

    setSubmitting(true);
    setError(undefined);
    try {
      await forgotPassword(email.trim());
      startCooldown();
      setStep("otp");
      toast.success("Verification code sent! Check your inbox.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send verification code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 2: OTP verification ────────────────────────────────────────
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (!cleanOtp || cleanOtp.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      const result = await verifyOtp(email.trim(), cleanOtp);
      setRecoveryToken(result.data?.recoveryToken);
      setStep("password");
      toast.success("Code verified. Please set your new password.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid or expired verification code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError(undefined);
    try {
      await resendOtp(email.trim());
      startCooldown();
      toast.success("A new verification code has been sent.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resend code.";
      toast.error(msg);
    }
  };

  // ── Step 3: New password ────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must contain at least one letter and one number.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(undefined);
    try {
      await resetPassword(password, recoveryToken, email.trim(), otp.trim());
      setStep("done");
      toast.success("Password updated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset password.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Shared card wrapper ─────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <LogoMark size="md" />
          <div>
            <p className="text-sm font-semibold">{UNIVERSITY_NAME}</p>
            <p className="text-xs text-muted-foreground">{SYSTEM_NAME}</p>
          </div>
        </div>

        {/* Step indicator */}
        {step !== "done" && (
          <div className="flex items-center gap-2">
            {(["email", "otp", "password"] as const).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : ["email", "otp", "password"].indexOf(step) > i
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && <div className={`h-px flex-1 ${["email","otp","password"].indexOf(step) > i ? "bg-primary/40" : "bg-muted"}`} />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── STEP 1: Email ─── */}
        {step === "email" && (
          <>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your registered email address. We&apos;ll send you a 6-digit verification code.
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} noValidate className="space-y-4">
              {error && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}
              <FormField id="reset-email" label="Email Address" required error={error}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(undefined); }}
                    placeholder="admin@dsvv.edu.in"
                    autoComplete="email"
                    className="pl-9"
                    invalid={Boolean(error)}
                  />
                </div>
              </FormField>
              <Button type="submit" className="w-full py-5 font-semibold text-base shadow-sm" loading={submitting}>
                <KeyRound className="h-4 w-4 mr-2" />
                Send Verification Code
              </Button>
            </form>
          </>
        )}

        {/* ── STEP 2: OTP ─── */}
        {step === "otp" && (
          <>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Enter verification code</h1>
              <p className="text-sm text-muted-foreground">
                A 6-digit code was sent to <span className="font-medium text-foreground">{email}</span>. It is valid for 10 minutes.
              </p>
            </div>

            <form onSubmit={handleOtpSubmit} noValidate className="space-y-4">
              {error && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}
              <FormField id="otp-code" label="Verification Code" required error={error}>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={otp}
                    onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(undefined); }}
                    placeholder="6-digit code"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="pl-9 font-mono text-lg tracking-widest"
                    invalid={Boolean(error)}
                  />
                </div>
              </FormField>

              <Button type="submit" className="w-full py-5 font-semibold text-base shadow-sm" loading={submitting}>
                Verify Code
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive a code? Resend"}
                </button>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { setStep("email"); setOtp(""); setError(undefined); }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Change email address
              </Button>
            </form>
          </>
        )}

        {/* ── STEP 3: New password ─── */}
        {step === "password" && (
          <>
            <div className="space-y-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
              <p className="text-sm text-muted-foreground">
                Choose a strong password with at least 8 characters, including at least one letter and one number.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} noValidate className="space-y-4">
              {error && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
                  {error}
                </div>
              )}
              <FormField id="new-password" label="New Password" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(undefined); }}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="pl-9 pr-9"
                    invalid={Boolean(error)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <FormField id="confirm-new-password" label="Confirm New Password" required>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(undefined); }}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="pl-9"
                  />
                </div>
              </FormField>

              <Button type="submit" className="w-full py-5 font-semibold text-base shadow-sm" loading={submitting}>
                Update Password
              </Button>
            </form>
          </>
        )}

        {/* ── STEP 4: Done ─── */}
        {step === "done" && (
          <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h2 className="text-base font-semibold">Password Updated</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Your password has been changed successfully. You can now sign in with your new credentials.
            </p>
            <Button asChild className="w-full mt-2">
              <Link href="/login">Sign In Now</Link>
            </Button>
          </div>
        )}

        {/* Back link (not shown on done step) */}
        {step !== "done" && (
          <div className="pt-2">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/login">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to sign in
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
