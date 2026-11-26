"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserPlus,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FormField } from "@/components/shared/form-field";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demo-accounts";
import { errorMessage, fieldErrors } from "@/lib/api";
import { ROLE_HOME, type Role } from "@/lib/types";
import { validateEmail, type FieldErrors } from "@/lib/validation";

/**
 * Modern Security & Authentication Console.
 *
 * Provides dual mode:
 * 1. Sign In (for guards, admins, and university personnel)
 * 2. Register New Guard (4 fields only: Full Name, Mobile, Email, Password -> Admin Approval Workflow)
 */
export function LoginForm({
  expectedRole,
  title,
  subtitle,
}: {
  expectedRole?: Role;
  title?: string;
  subtitle?: string;
} = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn, session, ready } = useAuth();

  const [mode, setMode] = React.useState<"signin" | "register">("signin");

  // Sign In State
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors<"email" | "password" | "form">>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [guardStatusNotice, setGuardStatusNotice] = React.useState<{
    tone: "pending" | "rejected";
    title: string;
    message: string;
  } | null>(null);

  // Guard Registration State (ONLY 4 fields)
  const [regFullName, setRegFullName] = React.useState("");
  const [regMobile, setRegMobile] = React.useState("");
  const [regEmail, setRegEmail] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [showRegPassword, setShowRegPassword] = React.useState(false);
  const [regSubmitting, setRegSubmitting] = React.useState(false);
  const [regErrors, setRegErrors] = React.useState<{
    fullName?: string;
    mobile?: string;
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [regSuccess, setRegSuccess] = React.useState<{
    requestId: string;
    fullName: string;
    email: string;
    message: string;
  } | null>(null);

  const nextParam = params.get("next");

  const getSafeRedirect = (target: string | null, role: Role): string => {
    if (!target) return ROLE_HOME[role];
    if (
      (target.startsWith("/administrator") || target.startsWith("/super-admin")) &&
      role !== "super_admin"
    ) {
      return ROLE_HOME[role];
    }
    if (target.startsWith("/admin") && role !== "admin" && role !== "super_admin") {
      return ROLE_HOME[role];
    }
    if (
      (target.startsWith("/security") || target.startsWith("/guard")) &&
      role !== "security" &&
      role !== "admin" &&
      role !== "super_admin"
    ) {
      return ROLE_HOME[role];
    }
    return target;
  };

  // Already signed in — skip the form.
  React.useEffect(() => {
    if (ready && session && !submitting) {
      router.replace(getSafeRedirect(nextParam, session.role));
    }
  }, [ready, session, router, nextParam, submitting]);

  const fillDemo = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword("");
    setErrors({});
    setGuardStatusNotice(null);
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setGuardStatusNotice(null);

    const next: FieldErrors<"email" | "password" | "form"> = {};
    next.email = validateEmail(email);
    if (!password) next.password = "Password is required.";
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    try {
      const account = await signIn(email, password, expectedRole);
      toast.success(`Signed in as ${account.name}.`);
      router.replace(getSafeRedirect(nextParam, account.role));
    } catch (error) {
      const details = fieldErrors(error);
      const message = errorMessage(error, "We could not sign you in.");

      // Check for Guard Status notifications
      const lower = message.toLowerCase();
      if (lower.includes("awaiting admin approval") || lower.includes("pending administrator approval") || lower.includes("pending admin approval")) {
        setGuardStatusNotice({
          tone: "pending",
          title: "Registration Awaiting Admin Approval",
          message:
            "Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved.",
        });
        setErrors({});
      } else if (lower.includes("rejected")) {
        setGuardStatusNotice({
          tone: "rejected",
          title: "Registration Rejected by Administrator",
          message,
        });
        setErrors({});
      } else {
        setErrors({ ...details, form: details.email || details.password ? undefined : message });
        toast.error(message);
      }
      setSubmitting(false);
    }
  };

  const handleRegisterGuard = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof regErrors = {};

    // 1. Full Name validation
    if (!regFullName.trim() || regFullName.trim().length < 3) {
      nextErrors.fullName = "Please enter your full name (at least 3 characters).";
    }

    // 2. Mobile validation (Indian 10-digit number format)
    const rawDigits = regMobile.replace(/\D/g, "");
    const cleanDigits = rawDigits.length === 12 && rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;
    if (!cleanDigits || !/^[6-9]\d{9}$/.test(cleanDigits)) {
      nextErrors.mobile = "Please enter a valid 10-digit Indian mobile number (+91 optional).";
    }

    // 3. Email validation
    const emailErr = validateEmail(regEmail);
    if (emailErr) {
      nextErrors.email = emailErr;
    }

    // 4. Password validation (secure password policy)
    if (!regPassword || regPassword.length < 6) {
      nextErrors.password = "Password must be at least 6 characters long.";
    }

    setRegErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setRegSubmitting(true);
    try {
      const response = await fetch("/api/guards/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: regFullName.trim(),
          phone: cleanDigits,
          mobileNumber: cleanDigits,
          email: regEmail.trim(),
          password: regPassword,
        }),
      });

      const res = await response.json();
      if (!response.ok || !res.ok) {
        throw new Error(res.error?.message || "Registration failed. Please check your information.");
      }

      setRegSuccess({
        requestId: res.data?.requestId || res.data?.id || "REQ-GUARD",
        fullName: regFullName.trim(),
        email: regEmail.trim(),
        message:
          res.message ||
          "Your guard registration request has been submitted successfully. Your account is currently awaiting Admin approval. You will be able to access the Guard Dashboard after your request is approved.",
      });
      toast.success("Guard registration request submitted!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit guard registration.";
      setRegErrors({ form: msg });
      toast.error(msg);
    } finally {
      setRegSubmitting(false);
    }
  };

  const accounts = expectedRole
    ? DEMO_ACCOUNTS.filter((a) => a.role === expectedRole)
    : DEMO_ACCOUNTS;

  const defaultTitle =
    expectedRole === "super_admin"
      ? "Administrator Login"
      : expectedRole === "admin"
        ? "Admin Login"
        : expectedRole === "security"
          ? "Security Guard Portal"
          : "Sign in to the console";

  const defaultSubtitle =
    expectedRole === "super_admin"
      ? "Master executive console for Campus Security Directors and University Administrators."
      : expectedRole === "admin"
        ? "Access the campus security operational dashboard, approvals and reports."
        : expectedRole === "security"
          ? "Gate operations console — verification, check-in, check-out and patrol dispatch."
          : "Access the campus security dashboard, approvals and gate operations.";

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Portal Header */}
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">{title ?? defaultTitle}</h1>
        <p className="text-sm text-muted-foreground">{subtitle ?? defaultSubtitle}</p>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 rounded-lg border border-border bg-muted/40 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => {
            setMode("signin");
            setGuardStatusNotice(null);
          }}
          className={`flex items-center justify-center gap-2 rounded-md py-2 transition-all ${
            mode === "signin"
              ? "bg-background text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LogIn className="h-4 w-4" />
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("register");
            setRegSuccess(null);
            setRegErrors({});
          }}
          className={`flex items-center justify-center gap-2 rounded-md py-2 transition-all ${
            mode === "register"
              ? "bg-background text-foreground shadow-xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserPlus className="h-4 w-4" />
          Register New Guard
        </button>
      </div>

      {/* ==================================================================== */}
      {/* MODE 1: SIGN IN FORM                                                  */}
      {/* ==================================================================== */}
      {mode === "signin" && (
        <div className="space-y-4">
          {/* Status Alert for Pending or Rejected Guards */}
          {guardStatusNotice && (
            <div
              role="alert"
              className={`rounded-lg border p-4 space-y-2 ${
                guardStatusNotice.tone === "pending"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                {guardStatusNotice.tone === "pending" ? (
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <span>{guardStatusNotice.title}</span>
              </div>
              <p className="text-xs leading-relaxed opacity-90">{guardStatusNotice.message}</p>
              {guardStatusNotice.tone === "pending" && (
                <div className="pt-1">
                  <Badge variant="outline" className="border-amber-500/40 bg-amber-500/20 text-amber-800 dark:text-amber-200 text-[11px] font-bold">
                    PENDING – Awaiting Approval
                  </Badge>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSignIn} noValidate className="space-y-4">
            {errors.form ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
              >
                {errors.form}
              </div>
            ) : null}

            <FormField id="login-email" label="Email Address" required error={errors.email}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((p) => ({ ...p, email: undefined, form: undefined }));
                    setGuardStatusNotice(null);
                  }}
                  placeholder="guard@dsvv.ac.in"
                  autoComplete="username"
                  className="pl-9"
                  invalid={Boolean(errors.email)}
                />
              </div>
            </FormField>

            <FormField id="login-password" label="Password" required error={errors.password}>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((p) => ({ ...p, password: undefined, form: undefined }));
                    setGuardStatusNotice(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pl-9 pr-10"
                  invalid={Boolean(errors.password)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </FormField>

            <div className="flex items-center justify-between pt-1">
              <Link
                href="/forgot-password"
                className="text-xs text-primary font-medium hover:underline focus:outline-none"
              >
                Forgot Password?
              </Link>
              <button
                type="button"
                onClick={() => setMode("register")}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                New guard? Register here
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" className="w-full py-5 font-semibold text-base shadow-sm" loading={submitting}>
                <LogIn className="h-4 w-4 mr-1" />
                Sign In as Guard
              </Button>
            </div>
          </form>

          {/* Seeded demonstration accounts */}
          <section
            aria-labelledby="demo-accounts"
            className="rounded-lg border border-warning/30 bg-warning/[0.07] p-4"
          >
            <div className="flex gap-2.5">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-strong" aria-hidden />
              <div className="min-w-0 space-y-1">
                <h2 id="demo-accounts" className="text-sm font-semibold">
                  Demonstration accounts
                </h2>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Select an authorized demo account to test role-based authentication and gate permissions.
                </p>
              </div>
            </div>

            <Separator className="my-3.5 bg-warning/20" />

            <ul className="grid gap-2 sm:grid-cols-2">
              {accounts.map((account) => (
                <li key={account.role}>
                  <button
                    type="button"
                    onClick={() => fillDemo(account)}
                    className="w-full rounded-md border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block text-xs font-semibold">{account.label}</span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">
                      {account.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODE 2: REGISTER NEW GUARD (ONLY 4 FIELDS)                            */}
      {/* ==================================================================== */}
      {mode === "register" && (
        <div className="space-y-4">
          {regSuccess ? (
            /* Successful Registration Request Submission State */
            <div className="space-y-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Clock className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/20 text-amber-800 dark:text-amber-200 font-bold px-2.5 py-0.5 text-xs">
                  PENDING – Awaiting Admin Approval
                </Badge>
                <h2 className="text-lg font-bold text-foreground">Registration Submitted</h2>
              </div>

              {/* Reference ID Card */}
              <div className="rounded-lg border border-border bg-card p-3 text-left">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Registration Reference</p>
                <p className="font-mono text-base font-bold text-primary">{regSuccess.requestId}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Applicant: {regSuccess.fullName} ({regSuccess.email})</p>
              </div>

              {/* Exact Required Status Message */}
              <p className="text-sm leading-relaxed text-muted-foreground bg-background/80 p-3.5 rounded-lg border border-border/60">
                &ldquo;{regSuccess.message}&rdquo;
              </p>

              <div className="pt-2">
                <Button
                  onClick={() => {
                    setEmail(regSuccess.email);
                    setPassword("");
                    setRegSuccess(null);
                    setMode("signin");
                  }}
                  className="w-full"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  Proceed to Sign In
                </Button>
              </div>
            </div>
          ) : (
            /* Registration Form with ONLY 4 fields */
            <form onSubmit={handleRegisterGuard} noValidate className="space-y-4">
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs leading-relaxed text-blue-900 dark:text-blue-200">
                <span className="font-semibold">Security Gate Approval:</span> Newly registered security guards must be approved by the Chief Security Administrator before accessing the Guard Dashboard.
              </div>

              {regErrors.form ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
                >
                  {regErrors.form}
                </div>
              ) : null}

              {/* 1. Full Name */}
              <FormField id="reg-name" label="Full Name" required error={regErrors.fullName}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-name"
                    value={regFullName}
                    onChange={(e) => {
                      setRegFullName(e.target.value);
                      setRegErrors((p) => ({ ...p, fullName: undefined, form: undefined }));
                    }}
                    placeholder="e.g. Ramesh Chandra Sharma"
                    autoComplete="name"
                    className="pl-9"
                    invalid={Boolean(regErrors.fullName)}
                  />
                </div>
              </FormField>

              {/* 2. Mobile Number (Indian format) */}
              <FormField id="reg-phone" label="Mobile Number" required error={regErrors.mobile}>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-phone"
                    type="tel"
                    value={regMobile}
                    onChange={(e) => {
                      setRegMobile(e.target.value);
                      setRegErrors((p) => ({ ...p, mobile: undefined, form: undefined }));
                    }}
                    placeholder="9876543210 (+91 optional)"
                    autoComplete="tel"
                    maxLength={13}
                    className="pl-9"
                    invalid={Boolean(regErrors.mobile)}
                  />
                </div>
              </FormField>

              {/* 3. Email Address */}
              <FormField id="reg-email" label="Email Address" required error={regErrors.email}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-email"
                    type="email"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      setRegErrors((p) => ({ ...p, email: undefined, form: undefined }));
                    }}
                    placeholder="guard.ramesh@dsvv.ac.in"
                    autoComplete="email"
                    className="pl-9"
                    invalid={Boolean(regErrors.email)}
                  />
                </div>
              </FormField>

              {/* 4. Password */}
              <FormField id="reg-password" label="Password" required error={regErrors.password}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="reg-password"
                    type={showRegPassword ? "text" : "password"}
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      setRegErrors((p) => ({ ...p, password: undefined, form: undefined }));
                    }}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    className="pl-9 pr-10"
                    invalid={Boolean(regErrors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={showRegPassword ? "Hide password" : "Show password"}
                  >
                    {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <div className="pt-2 space-y-2">
                <Button type="submit" className="w-full py-5 font-semibold text-base shadow-sm" loading={regSubmitting}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Submit Registration Request
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setMode("signin")}
                  className="w-full text-xs text-muted-foreground"
                >
                  Already registered? Back to Sign In
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Back to public site */}
      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          Back to public site
        </Link>
      </Button>
    </div>
  );
}
