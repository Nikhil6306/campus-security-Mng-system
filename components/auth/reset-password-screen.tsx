"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { LogoMark, SYSTEM_NAME, UNIVERSITY_NAME } from "@/components/shared/logo";

export function ResetPasswordScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword } = useAuth();

  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  // Token might come from query or hash
  const token = searchParams.get("token") || undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      await resetPassword(password, token);
      setSuccess(true);
      toast.success("Password has been reset successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reset password.";
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
          <h1 className="text-2xl font-semibold tracking-tight">Set new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a strong password with at least 8 characters.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-5 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h2 className="text-base font-semibold">Password Updated</h2>
            <p className="text-xs text-muted-foreground">
              Your password has been changed. You can now sign in with your new credentials.
            </p>
            <Button asChild className="w-full mt-2">
              <Link href="/login">Sign In Now</Link>
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

            <FormField id="new-password" label="New Password" required error={error}>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(undefined);
                  }}
                  placeholder="Minimum 8 characters"
                  autoComplete="new-password"
                  className="pl-9"
                  invalid={Boolean(error)}
                />
              </div>
            </FormField>

            <FormField id="confirm-new-password" label="Confirm New Password" required>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(undefined);
                  }}
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
