"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Mail,
  RefreshCw,
  Shield,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/api";
import { validateEmail } from "@/lib/validation";

interface ChangeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentEmail: string;
  onSuccess?: (newEmail: string) => void;
}

type Step = "request" | "verify_old" | "verify_new" | "completed";

const COOLDOWN_SECONDS = 60;
const EXPIRY_SECONDS = 300; // 5 minutes

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

export function ChangeEmailDialog({
  open,
  onOpenChange,
  currentEmail,
  onSuccess,
}: ChangeEmailDialogProps) {
  const [step, setStep] = React.useState<Step>("request");
  const [newEmail, setNewEmail] = React.useState("");
  const [confirmEmail, setConfirmEmail] = React.useState("");
  const [oldOtp, setOldOtp] = React.useState("");
  const [newOtp, setNewOtp] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  // Cooldown & Expiry Timers
  const [cooldown, setCooldown] = React.useState(0);
  const [expiryTimer, setExpiryTimer] = React.useState(0);
  const cooldownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimers = React.useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    setExpiryTimer(EXPIRY_SECONDS);

    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    if (expiryRef.current) clearInterval(expiryRef.current);
    expiryRef.current = setInterval(() => {
      setExpiryTimer((prev) => {
        if (prev <= 1) {
          if (expiryRef.current) clearInterval(expiryRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

  // Reset state on open/close
  React.useEffect(() => {
    if (open) {
      setStep("request");
      setNewEmail("");
      setConfirmEmail("");
      setOldOtp("");
      setNewOtp("");
      setError(undefined);
      setCooldown(0);
      setExpiryTimer(0);
    }
  }, [open]);

  // Format expiry mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Step 1: Request Email Change ───────────────────────────────────────────
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = newEmail.trim().toLowerCase();
    const emailErr = validateEmail(cleanNew);
    if (emailErr) { setError(emailErr); return; }

    if (cleanNew === currentEmail.trim().toLowerCase()) {
      setError("New email must be different from your current email.");
      return;
    }

    if (cleanNew !== confirmEmail.trim().toLowerCase()) {
      setError("Email addresses do not match.");
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      await api.requestEmailChange(cleanNew);
      startTimers();
      setStep("verify_old");
      toast.success(`Verification code sent to ${maskEmail(currentEmail)}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to initiate email change.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify Old Email OTP ───────────────────────────────────────────
  const handleVerifyOld = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = oldOtp.trim().replace(/\D/g, "");
    if (cleanOtp.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      await api.verifyOldEmailOtp(cleanOtp);
      startTimers(); // Restart timers for the new email OTP
      setStep("verify_new");
      toast.success(`Current email verified! Verification code sent to ${newEmail}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid or expired code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOld = async () => {
    if (cooldown > 0) return;
    setError(undefined);
    try {
      await api.requestEmailChange(newEmail.trim().toLowerCase());
      startTimers();
      toast.success("A new verification code has been sent.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resend code.";
      toast.error(msg);
    }
  };

  // ── Step 3: Verify New Email OTP ───────────────────────────────────────────
  const handleVerifyNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = newOtp.trim().replace(/\D/g, "");
    if (cleanOtp.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const res = await api.verifyNewEmailOtp(cleanOtp);
      setStep("completed");
      toast.success("Email changed successfully!");
      if (onSuccess) onSuccess(res.updatedEmail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Invalid or expired code.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendNew = async () => {
    if (cooldown > 0) return;
    setError(undefined);
    try {
      // Re-trigger verifyOld to get a fresh OTP sent to new email
      await api.verifyOldEmailOtp(oldOtp.trim().replace(/\D/g, ""));
      startTimers();
      toast.success(`A new verification code has been sent to ${newEmail}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to resend code.";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            Change Registered Email
          </DialogTitle>
          <DialogDescription>
            {step === "request" && "Enter your new email address. Two-factor verification will be required on both email addresses."}
            {step === "verify_old" && `Enter the 6-digit code sent to your current email (${maskEmail(currentEmail)}).`}
            {step === "verify_new" && `Enter the 6-digit confirmation code sent to your new email (${newEmail}).`}
            {step === "completed" && "Your registered email address has been updated successfully."}
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        {step !== "completed" && (
          <div className="flex items-center gap-2 py-2">
            {[
              { id: "request", label: "1. Details" },
              { id: "verify_old", label: "2. Current Email" },
              { id: "verify_new", label: "3. New Email" },
            ].map((s, idx) => {
              const active = step === s.id;
              const completed =
                (step === "verify_old" && idx === 0) ||
                (step === "verify_new" && idx <= 1);
              return (
                <React.Fragment key={s.id}>
                  <div
                    className={`flex h-6 px-2 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : completed
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </div>
                  {idx < 2 && <div className="h-px flex-1 bg-border" />}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 1: Request ──────────────────────────────────────────────── */}
        {step === "request" && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Current Email</label>
              <Input value={currentEmail} disabled className="bg-muted text-muted-foreground" />
            </div>

            <FormField id="new-email" label="New Email Address" required>
              <Input
                id="new-email"
                type="email"
                placeholder="officer.new@dsvv.edu.in"
                value={newEmail}
                onChange={(e) => { setNewEmail(e.target.value); setError(undefined); }}
                autoComplete="email"
              />
            </FormField>

            <FormField id="confirm-email" label="Confirm New Email Address" required>
              <Input
                id="confirm-email"
                type="email"
                placeholder="Re-enter new email address"
                value={confirmEmail}
                onChange={(e) => { setConfirmEmail(e.target.value); setError(undefined); }}
              />
            </FormField>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} disabled={!newEmail || !confirmEmail}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>
        )}

        {/* ── STEP 2: Verify Old Email ─────────────────────────────────────── */}
        {step === "verify_old" && (
          <form onSubmit={handleVerifyOld} className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              A 6-digit verification code was sent to <strong className="text-foreground">{maskEmail(currentEmail)}</strong>.
              Code expires in: <span className="font-semibold text-primary">{formatTimer(expiryTimer)}</span>
            </div>

            <FormField id="old-otp" label="Current Email Verification Code" required>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="old-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={oldOtp}
                  onChange={(e) => { setOldOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(undefined); }}
                  placeholder="000000"
                  className="pl-9 font-mono text-center tracking-widest text-lg"
                  autoFocus
                />
              </div>
            </FormField>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResendOld}
                disabled={cooldown > 0}
                className="inline-flex items-center gap-1 text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                <RefreshCw className="h-3 w-3" />
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("request"); setError(undefined); }}
                className="text-muted-foreground hover:underline"
              >
                Change address
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} disabled={oldOtp.length < 6 || expiryTimer <= 0}>
                Verify Current Email
              </Button>
            </div>
          </form>
        )}

        {/* ── STEP 3: Verify New Email ─────────────────────────────────────── */}
        {step === "verify_new" && (
          <form onSubmit={handleVerifyNew} className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              A final 6-digit code was sent to your new email <strong className="text-foreground">{newEmail}</strong>.
              Code expires in: <span className="font-semibold text-primary">{formatTimer(expiryTimer)}</span>
            </div>

            <FormField id="new-otp" label="New Email Confirmation Code" required>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={newOtp}
                  onChange={(e) => { setNewOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(undefined); }}
                  placeholder="000000"
                  className="pl-9 font-mono text-center tracking-widest text-lg"
                  autoFocus
                />
              </div>
            </FormField>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResendNew}
                disabled={cooldown > 0}
                className="inline-flex items-center gap-1 text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                <RefreshCw className="h-3 w-3" />
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} disabled={newOtp.length < 6 || expiryTimer <= 0}>
                Confirm &amp; Update Email
              </Button>
            </div>
          </form>
        )}

        {/* ── STEP 4: Completed ────────────────────────────────────────────── */}
        {step === "completed" && (
          <div className="space-y-4 py-4 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h3 className="text-base font-semibold">Email Successfully Updated</h3>
            <p className="text-xs text-muted-foreground">
              Your registered email has been updated to <strong>{newEmail}</strong>.
              Confirmation notifications have been sent to both your old and new addresses.
            </p>
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
