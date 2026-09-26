"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Info, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { FormField } from "@/components/shared/form-field";
import { toast } from "@/components/ui/toaster";
import { useAuth } from "@/components/providers/auth-provider";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demo-accounts";
import { errorMessage, fieldErrors } from "@/lib/api";
import { ROLE_HOME, type Role } from "@/lib/types";
import { validateEmail, type FieldErrors } from "@/lib/validation";

/**
 * Sign-in form.
 *
 * Credentials are posted to `/api/auth/login`; nothing is verified here. On
 * success the server sets an httpOnly session cookie, so the browser never
 * holds a token it could leak.
 */
export function LoginForm({ expectedRole }: { expectedRole?: Role } = {}) {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn, session, ready } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors<"email" | "password" | "form">>({});
  const [submitting, setSubmitting] = React.useState(false);

  const nextParam = params.get("next");

  // Already signed in — skip the form.
  React.useEffect(() => {
    if (ready && session && !submitting) {
      router.replace(nextParam ?? ROLE_HOME[session.role]);
    }
  }, [ready, session, router, nextParam, submitting]);

  const fillDemo = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrors({});
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const next: FieldErrors<"email" | "password" | "form"> = {};
    next.email = validateEmail(email);
    if (!password) next.password = "Password is required.";
    setErrors(next);
    if (next.email || next.password) return;

    setSubmitting(true);
    try {
      const account = await signIn(email, password, expectedRole);
      toast.success(`Signed in as ${account.name}.`);
      router.replace(nextParam ?? ROLE_HOME[account.role]);
    } catch (error) {
      const details = fieldErrors(error);
      const message = errorMessage(error, "We could not sign you in.");
      setErrors({ ...details, form: details.email || details.password ? undefined : message });
      toast.error(message);
      setSubmitting(false);
    }
  };

  const accounts = expectedRole
    ? DEMO_ACCOUNTS.filter(
        (a) => a.role === expectedRole || (expectedRole === "admin" && a.role === "super_admin"),
      )
    : DEMO_ACCOUNTS;

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to the console</h1>
        <p className="text-sm text-muted-foreground">
          Access the campus security dashboard, approvals and gate operations.
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {errors.form ? (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            {errors.form}
          </div>
        ) : null}

        <FormField id="login-email" label="Email" required error={errors.email}>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors((p) => ({ ...p, email: undefined, form: undefined }));
            }}
            placeholder="admin@dsvv.edu.in"
            autoComplete="username"
            invalid={Boolean(errors.email)}
          />
        </FormField>

        <FormField id="login-password" label="Password" required error={errors.password}>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((p) => ({ ...p, password: undefined, form: undefined }));
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-10"
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

        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          <LogIn className="h-4 w-4" />
          Sign in
        </Button>
      </form>

      {/* Seeded demonstration accounts — remove before real deployment. */}
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
              These accounts ship with the seeded demo data. Passwords are stored hashed and
              verified on the server — delete or re-password these accounts before the system
              handles real visitors.
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
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {account.password}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          Select an account to fill the form, then sign in.
        </p>
      </section>

      <Button asChild variant="ghost" size="sm" className="w-full">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" />
          Back to public site
        </Link>
      </Button>
    </div>
  );
}
