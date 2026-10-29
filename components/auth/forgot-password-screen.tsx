"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { LogoMark, SYSTEM_NAME, UNIVERSITY_NAME } from "@/components/shared/logo";
import { validateEmail } from "@/lib/validation";

export function ForgotPasswordScreen() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      await forgotPassword(email.trim());
      setSent(true);
      toast.success("Password reset link has been dispatched.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to request password reset.";
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <LogoMark size="md" />
          <div>
            <p className="text-sm font-semibold">{UNIVERSITY_NAME}</p>
            <p className="text-xs text-muted-foreground">{SYSTEM_NAME}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your registered email address and we&apos;ll send you a link to reset your password.
          </p>
        </div>

        {sent ? (
          <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h2 className="text-base font-semibold">Check your inbox</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              If an account matches <span className="font-medium text-foreground">{email}</span>, you will receive password reset instructions shortly.
            </p>
            <Button asChild variant="outline" className="w-full mt-2">
              <Link href="/login">Return to Sign In</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {error ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
              >
                {error}
              </div>
            ) : null}

            <FormField id="reset-email" label="Email Address" required error={error}>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(undefined);
                  }}
                  placeholder="admin@dsvv.edu.in"
                  autoComplete="email"
                  className="pl-9"
                  invalid={Boolean(error)}
                />
              </div>
            </FormField>

            <Button type="submit" className="w-full py-5 font-semibold text-base shadow-sm" loading={submitting}>
              <KeyRound className="h-4 w-4 mr-2" />
              Send Reset Link
            </Button>
          </form>
        )}

        <div className="pt-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href="/login">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to sign in
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
