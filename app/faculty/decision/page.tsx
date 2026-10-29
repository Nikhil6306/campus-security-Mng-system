"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { InlineLoader } from "@/components/shared/states";
import { formatDate, formatTime } from "@/lib/utils";

interface DecisionData {
  valid: boolean;
  alreadyDecided?: boolean;
  expired?: boolean;
  reason?: string;
  intendedAction?: "accept" | "reject" | "decide";
  booking: {
    id: string;
    fullName: string;
    purpose: string;
    visitDate: string;
    visitTime: string;
    status: string;
    hostName: string;
    department?: string;
    numberOfVisitors?: number;
    vehicleNumber?: string;
  };
  faculty?: {
    id: string;
    name: string;
    department?: string;
    designation?: string;
  };
}

function FacultyDecisionView() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const initialAction = (searchParams.get("action") as "accept" | "reject") || "accept";

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DecisionData | null>(null);

  const [action, setAction] = React.useState<"accept" | "reject">(initialAction);
  const [rejectionReason, setRejectionReason] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [decisionOutcome, setDecisionOutcome] = React.useState<{
    success: boolean;
    status: string;
    message: string;
  } | null>(null);

  // Load and verify the token on mount
  React.useEffect(() => {
    if (!token) {
      setError("No decision token found in link.");
      setLoading(false);
      return;
    }

    fetch(`/api/faculty/decision?token=${encodeURIComponent(token)}&action=${initialAction}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error?.message || "Invalid or expired decision link.");
        }
        setData(json.data);
        if (json.data.intendedAction === "reject" || json.data.intendedAction === "accept") {
          setAction(json.data.intendedAction);
        }
      })
      .catch((err) => {
        setError(err.message || "Unable to verify decision link.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, initialAction]);

  const handleExecuteDecision = async (decisionToApply: "accept" | "reject") => {
    if (!token || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/faculty/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          action: decisionToApply,
          reason: decisionToApply === "reject" ? rejectionReason.trim() || undefined : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error?.message || "Failed to submit decision.");
      }

      setDecisionOutcome({
        success: true,
        status: json.data?.status || (decisionToApply === "accept" ? "Approved" : "Rejected"),
        message: json.data?.message || (decisionToApply === "accept" ? "Visit request approved." : "Visit request declined."),
      });
      toast.success(decisionToApply === "accept" ? "Visit Approved" : "Visit Declined");
    } catch (err: any) {
      toast.error(err.message || "Decision could not be applied.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-4">
        <InlineLoader label="Verifying secure decision token…" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container max-w-lg py-12 px-4">
        <Card className="border-destructive/30 bg-destructive/5 shadow-md">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-8 w-8" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-destructive">Unable to Verify Link</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {error || "This action link is either invalid, corrupted, or has already expired."}
            </p>
            <div className="mt-6">
              <Button asChild variant="outline">
                <a href="/login">Staff Portal Sign In</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { booking, faculty } = data;
  const isAlreadyDecided = Boolean(decisionOutcome || data.alreadyDecided || booking.status !== "Pending");
  const finalStatus = decisionOutcome?.status || booking.status;

  return (
    <div className="container max-w-xl py-10 px-4">
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <ShieldCheck className="h-3.5 w-3.5" />
          Campus Security Verification
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground">
          Faculty Visit Request Decision
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Dev Sanskriti Vishwavidyalaya, Haridwar
        </p>
      </div>

      <Card className="shadow-md border-border/80">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Faculty Header */}
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Reviewing Host</span>
              <p className="font-semibold text-base text-foreground">{faculty?.name || booking.hostName}</p>
              {faculty?.department && (
                <p className="text-xs text-muted-foreground">{faculty.department} • {faculty.designation || "Faculty"}</p>
              )}
            </div>
            <Badge
              variant={
                finalStatus === "Approved"
                  ? "success"
                  : finalStatus === "Rejected"
                  ? "destructive"
                  : "warning"
              }
              className="text-xs px-2.5 py-0.5"
            >
              {finalStatus.toUpperCase()}
            </Badge>
          </div>

          {/* Already Decided Banner */}
          {isAlreadyDecided && (
            <div
              className={`rounded-lg p-4 text-sm ${
                finalStatus === "Approved"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800"
                  : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                {finalStatus === "Approved" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <span>Request {finalStatus === "Approved" ? "Accepted" : "Declined"}</span>
              </div>
              <p className="mt-1.5 text-xs opacity-90 leading-relaxed">
                {decisionOutcome?.message ||
                  (finalStatus === "Approved"
                    ? "This visit request has been approved. The digital QR pass has been delivered to the visitor."
                    : "This visit request was declined. The visitor has been politely notified.")}
              </p>
            </div>
          )}

          {/* Visit Details Card */}
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Visitor & Schedule Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" /> Visitor Name
                </span>
                <p className="font-semibold text-foreground">{booking.fullName}</p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Booking Reference
                </span>
                <p className="font-mono text-xs font-semibold text-foreground">{booking.id}</p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Date & Time
                </span>
                <p className="font-medium text-foreground">
                  {formatDate(booking.visitDate)} at {formatTime(booking.visitTime)}
                </p>
              </div>

              <div>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Purpose
                </span>
                <p className="font-medium text-foreground">{booking.purpose}</p>
              </div>

              {booking.numberOfVisitors && booking.numberOfVisitors > 1 && (
                <div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Party Size
                  </span>
                  <p className="font-medium text-foreground">{booking.numberOfVisitors} Visitors</p>
                </div>
              )}

              {booking.vehicleNumber && (
                <div>
                  <span className="text-xs text-muted-foreground">Vehicle Number</span>
                  <p className="font-mono font-medium text-foreground">{booking.vehicleNumber}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Decision Form (Only if Pending) */}
          {!isAlreadyDecided && (
            <div className="space-y-4 pt-2">
              {/* Action Selection Tabs */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAction("accept")}
                  className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                    action === "accept"
                      ? "border-emerald-600 bg-emerald-50/80 text-emerald-800 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500 font-semibold"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <CheckCircle2 className="h-5 w-5 mb-1 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold">Accept Visit</span>
                  <span className="text-[11px] opacity-75">Issue entry pass</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAction("reject")}
                  className={`flex flex-col items-center justify-center rounded-lg border p-3 text-center transition-all ${
                    action === "reject"
                      ? "border-red-600 bg-red-50/80 text-red-800 shadow-xs dark:bg-red-950/40 dark:text-red-300 dark:border-red-500 font-semibold"
                      : "border-border hover:bg-muted text-muted-foreground"
                  }`}
                >
                  <XCircle className="h-5 w-5 mb-1 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-semibold">Decline Visit</span>
                  <span className="text-[11px] opacity-75">Notify politely</span>
                </button>
              </div>

              {action === "accept" ? (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/40 p-4 text-xs text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Confirm Approval
                  </div>
                  <p className="leading-relaxed">
                    By clicking <strong>Confirm & Accept</strong>, you authorize this visit. The system will atomically record your decision, generate a secure digital visitor QR pass, and dispatch it to the visitor via WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-red-500/30 bg-red-50/40 p-4 text-xs text-red-800 dark:bg-red-950/20 dark:text-red-300">
                  <div className="flex items-center gap-1.5 font-semibold text-sm">
                    <XCircle className="h-4 w-4" />
                    Confirm Decline
                  </div>
                  <p className="leading-relaxed">
                    By declining, no QR pass will be issued. A respectful notification will be sent to the visitor advising them that the meeting could not be accommodated.
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="rejectionReason" className="text-xs font-semibold text-foreground">
                      Reason for Declining (Optional):
                    </Label>
                    <Input
                      id="rejectionReason"
                      type="text"
                      placeholder="e.g. Host unavailable, academic schedule conflict"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      maxLength={150}
                      className="text-xs bg-background"
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                {action === "accept" ? (
                  <Button
                    onClick={() => handleExecuteDecision("accept")}
                    disabled={submitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-6 text-base shadow-sm"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    {submitting ? "Processing Approval…" : "Confirm & Accept Visit"}
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleExecuteDecision("reject")}
                    disabled={submitting}
                    variant="destructive"
                    className="w-full font-semibold py-6 text-base shadow-sm"
                  >
                    <XCircle className="mr-2 h-5 w-5" />
                    {submitting ? "Processing Decline…" : "Confirm & Decline Request"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Footer Portal Links */}
          <div className="border-t pt-4 text-center">
            <a
              href={`/teacher/meetings?request=${encodeURIComponent(booking.id)}`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              Open in Staff Portal Dashboard
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function FacultyDecisionPage() {
  return (
    <Suspense fallback={<InlineLoader label="Loading decision interface…" />}>
      <FacultyDecisionView />
    </Suspense>
  );
}
