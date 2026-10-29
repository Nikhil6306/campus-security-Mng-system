"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, CheckCircle2, Lock, Mail, Phone, ShieldCheck, User, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { LogoMark, SYSTEM_NAME, UNIVERSITY_NAME } from "@/components/shared/logo";
import { ROLE_HOME, type Role } from "@/lib/types";
import { validateEmail, validateMobile } from "@/lib/validation";

export function SignupScreen() {
  const router = useRouter();
  const { signUp, session } = useAuth();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [role, setRole] = React.useState<Role>("visitor");
  const [submitting, setSubmitting] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string | undefined>>({});

  // If already signed in, redirect
  React.useEffect(() => {
    if (session) {
      router.replace(ROLE_HOME[session.role] || "/");
    }
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string | undefined> = {};
    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = "Please enter your full name (at least 3 characters).";
    }
    const emailErr = validateEmail(email);
    if (emailErr) newErrors.email = emailErr;

    if (phone.trim()) {
      const phoneErr = validateMobile(phone);
      if (phoneErr) newErrors.phone = phoneErr;
    }

    if (!password || password.length < 8) {
      newErrors.password = "Password must be at least 8 characters long.";
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    try {
      const result = await signUp({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        role,
      });

      if (result) {
        toast.success(`Welcome to ${SYSTEM_NAME}!`);
        router.replace(ROLE_HOME[result.role] || "/");
      } else {
        setSuccessMessage("Registration successful! Please check your email to verify your account before logging in.");
        toast.success("Account created successfully.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed. Please try again.";
      setErrors({ form: msg });
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-navy lg:block">
        <Image
          src="/assets/campus-main.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover opacity-25"
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy/90 via-navy/85 to-navy" />
        <div className="grid-overlay absolute inset-0 opacity-[0.07]" aria-hidden />

        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-3">
            <LogoMark size="lg" priority />
            <div>
              <p className="text-sm font-semibold text-white">{UNIVERSITY_NAME}</p>
              <p className="text-xs text-white/60">{SYSTEM_NAME}</p>
            </div>
          </div>

          <div className="max-w-md space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-cyanx-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Verified Campus Security Portal</span>
            </div>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
              Create an account for seamless campus access and visit management.
            </h2>
            <p className="text-sm leading-relaxed text-white/70">
              Register as a visitor for hassle-free pre-booking and digital passes, or as a student for gate clearance and outing requests.
            </p>
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} {UNIVERSITY_NAME} · All rights reserved.
          </p>
        </div>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md space-y-6">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <LogoMark size="lg" priority />
            <div>
              <p className="text-sm font-semibold">{UNIVERSITY_NAME}</p>
              <p className="text-xs text-muted-foreground">{SYSTEM_NAME}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">
              Sign up to book visits, view digital passes, and access campus services.
            </p>
          </div>

          {successMessage ? (
            <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-6 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h2 className="text-lg font-semibold">Account Registered</h2>
              <p className="text-sm text-muted-foreground">{successMessage}</p>
              <Button asChild className="w-full">
                <Link href="/login">Proceed to Sign In</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {errors.form ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
                >
                  {errors.form}
                </div>
              ) : null}

              <FormField id="signup-name" label="Full Name" required error={errors.fullName}>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      setErrors((p) => ({ ...p, fullName: undefined, form: undefined }));
                    }}
                    placeholder="Enter your full name"
                    autoComplete="name"
                    className="pl-9"
                    invalid={Boolean(errors.fullName)}
                  />
                </div>
              </FormField>

              <FormField id="signup-email" label="Email Address" required error={errors.email}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((p) => ({ ...p, email: undefined, form: undefined }));
                    }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="pl-9"
                    invalid={Boolean(errors.email)}
                  />
                </div>
              </FormField>

              <FormField id="signup-phone" label="Mobile Number" error={errors.phone}>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setErrors((p) => ({ ...p, phone: undefined, form: undefined }));
                    }}
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    className="pl-9"
                    invalid={Boolean(errors.phone)}
                  />
                </div>
              </FormField>

              <FormField id="signup-role" label="Account Type" required>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("visitor")}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      role === "visitor"
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="block text-sm font-semibold">Visitor / Guest</span>
                    <span className="block text-xs text-muted-foreground">For campus meetings and events</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("student")}
                    className={`rounded-md border p-3 text-left transition-colors ${
                      role === "student"
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <span className="block text-sm font-semibold">Student</span>
                    <span className="block text-xs text-muted-foreground">For campus outings and passes</span>
                  </button>
                </div>
              </FormField>

              <FormField id="signup-password" label="Password" required error={errors.password}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((p) => ({ ...p, password: undefined, form: undefined }));
                    }}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className="pl-9"
                    invalid={Boolean(errors.password)}
                  />
                </div>
              </FormField>

              <FormField id="signup-confirm-password" label="Confirm Password" required error={errors.confirmPassword}>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrors((p) => ({ ...p, confirmPassword: undefined, form: undefined }));
                    }}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    className="pl-9"
                    invalid={Boolean(errors.confirmPassword)}
                  />
                </div>
              </FormField>

              <Button type="submit" className="w-full py-5 font-semibold text-base shadow-sm" loading={submitting}>
                <UserPlus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            </form>
          )}

          <div className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Sign in
            </Link>
          </div>

          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to public site
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
