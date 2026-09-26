"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Car,
  CheckCircle2,
  Clock,
  DoorOpen,
  Keyboard,
  LogIn,
  LogOut,
  RotateCcw,
  ShieldAlert,
  User,
  Users,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { SectionHeader } from "@/components/shared/page-header";
import { FormField, DetailRow } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { QrScanner } from "@/components/security/qr-scanner";
import { VisitorPhotoPanel } from "@/components/shared/visitor-photo";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import type { VerificationResult } from "@/lib/api";
import { getGates } from "@/lib/selectors";
import { formatDate, formatTime } from "@/lib/utils";

/**
 * Gate scanning station.
 *
 * The camera decodes the QR locally and the decoded text is treated as nothing
 * more than a lookup key: it is posted to `/api/gate/verify`, which re-reads the
 * booking and returns the decision. A scan never admits anyone on its own, and
 * the CHECK IN button only appears once the server has said the pass is good.
 */

export default function SecurityScanPage() {
  const { session } = useAuth();
  const { db, ready } = useData();

  const gates = React.useMemo(() => getGates(db), [db]);
  const [gate, setGate] = React.useState<string>("");
  const [manual, setManual] = React.useState("");
  const [result, setResult] = React.useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [committing, setCommitting] = React.useState(false);
  const manualRef = React.useRef<HTMLInputElement>(null);

  // A guard's account is posted to a gate; default to theirs.
  React.useEffect(() => {
    if (gate) return;
    setGate(session?.gate && gates.includes(session.gate) ? session.gate : gates[0]);
  }, [gate, gates, session?.gate]);

  const verify = React.useCallback(
    async (payload: { token?: string; bookingId?: string }) => {
      setVerifying(true);
      try {
        const outcome = await api.verifyPass(payload);
        setResult(outcome);
        if (outcome.ok) {
          toast.success("Pass verified.", { description: outcome.booking?.fullName });
        } else {
          toast.error(outcome.issues[0]?.message ?? "This pass cannot be accepted.");
        }
      } catch (error) {
        toast.error(errorMessage(error, "That pass could not be verified."));
        setResult(null);
      } finally {
        setVerifying(false);
      }
    },
    [],
  );

  const reset = () => {
    setResult(null);
    setManual("");
    manualRef.current?.focus();
  };

  async function commit(action: "check-in" | "check-out") {
    const booking = result?.booking;
    if (!booking || !gate) return;

    setCommitting(true);
    try {
      if (action === "check-in") {
        const outcome = await api.checkIn(booking.id, gate);
        toast.success("Visitor checked in.", {
          description: `${outcome.booking.fullName} at ${outcome.gate}.`,
        });
      } else {
        const outcome = await api.checkOut(booking.id, gate);
        toast.success("Visitor checked out.", {
          description: `${outcome.booking.fullName} at ${outcome.gate}.`,
        });
      }
      // Re-verify so the panel shows the booking's new state rather than a guess.
      await verify({ bookingId: booking.id });
    } catch (error) {
      toast.error(errorMessage(error, "That gate action could not be completed."));
    } finally {
      setCommitting(false);
    }
  }

  const booking = result?.booking;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Scan Visitor Pass</h1>
          <p className="text-sm text-muted-foreground">
            Point the camera at the visitor&rsquo;s QR code. Every scan is verified against the
            booking record before anyone is admitted.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/security/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Back to console
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <SectionHeader
              title="Camera"
              description="Decoded on this device — no image is uploaded"
            />
            <div className="p-4">
              <QrScanner
                paused={verifying || Boolean(result)}
                onDetected={(value) => {
                  if (verifying || result) return;
                  void verify({ token: value });
                }}
                onUseManual={() => manualRef.current?.focus()}
              />
            </div>
          </Card>

          <Card>
            <SectionHeader title="No QR code?" description="Look the booking up by reference" />
            <form
              className="space-y-3 p-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                const reference = manual.trim();
                if (!reference) {
                  toast.error("Enter a booking reference to verify.");
                  return;
                }
                void verify({ bookingId: reference.toUpperCase() });
              }}
            >
              <FormField
                id="scan-manual"
                label="Booking reference"
                hint="Printed on the visitor pass, e.g. DSVV-VIS-2026-000124"
              >
                <Input
                  ref={manualRef}
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="DSVV-VIS-2026-000124"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-12 font-mono uppercase placeholder:font-sans placeholder:normal-case"
                />
              </FormField>
              <Button type="submit" size="lg" className="w-full" loading={verifying}>
                <Keyboard className="h-4 w-4" />
                Verify pass
              </Button>
            </form>
          </Card>

          <Card>
            <SectionHeader title="Gate" description="Where this movement is recorded" />
            <div className="p-4">
              <label htmlFor="scan-gate" className="sr-only">
                Gate
              </label>
              <Select value={gate} onValueChange={setGate}>
                <SelectTrigger id="scan-gate" className="h-12">
                  <SelectValue placeholder="Select a gate" />
                </SelectTrigger>
                <SelectContent>
                  {gates.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>
        </div>

        {/* ---------------- Result ---------------- */}
        <Card className="min-w-0">
          <SectionHeader
            title="Verification result"
            description="Decided by the server, not by the QR code"
            actions={
              result ? (
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Scan next
                </Button>
              ) : null
            }
          />

          {!result ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
                aria-hidden
              >
                <BadgeCheck className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium">Waiting for a pass</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Scan a visitor&rsquo;s QR code, or enter their booking reference, to see their
                details here.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {/* Decision banner */}
              <div
                role="status"
                className={
                  result.ok
                    ? "flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-4"
                    : "flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
                }
              >
                {result.ok ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-strong" aria-hidden />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
                )}
                <div className="min-w-0">
                  <p
                    className={
                      result.ok
                        ? "text-sm font-semibold text-success"
                        : "text-sm font-semibold text-destructive"
                    }
                  >
                    {result.ok ? "Pass verified — visitor may be admitted" : "Pass refused"}
                  </p>
                  {result.issues.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {result.issues.map((issue) => (
                        <li key={issue.code} className="text-sm text-muted-foreground">
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              {booking ? (
                <>
                  {/* Identity panel.

                      The photograph is the verification the rest of this screen
                      supports: the pass says who the booking is for, and the
                      officer's job is to decide the person holding it is that
                      person. Tapping it opens the full-size image. */}
                  <div className="flex items-start gap-4 rounded-lg border border-border p-4">
                    <VisitorPhotoPanel
                      photoUrl={booking.photoUrl}
                      name={booking.fullName}
                      caption={booking.id}
                      frameClassName="h-28 w-24 sm:h-32 sm:w-28"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-semibold">{booking.fullName}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {booking.visitorType}
                        {booking.organization ? ` · ${booking.organization}` : ""}
                      </p>
                      <p className="mt-1 truncate font-mono text-sm">
                        {booking.whatsappCountryCode ?? "+91"} {booking.whatsappNumber || booking.mobile}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={booking.status} />
                        {booking.badgeNumber ? (
                          <Badge variant="outline" size="sm">
                            Badge {booking.badgeNumber}
                          </Badge>
                        ) : null}
                        {booking.photoUrl ? null : (
                          <Badge variant="warning" size="sm">
                            No photo on record
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4">
                    <DetailRow label="Booking" value={booking.id} mono />
                    <DetailRow label="Purpose" value={booking.purpose} />
                    <DetailRow
                      label="Meeting with"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {booking.hostName}
                        </span>
                      }
                    />
                    <DetailRow label="Department" value={booking.department} />
                    <DetailRow
                      label="Date"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {formatDate(booking.visitDate)} · {formatTime(booking.visitTime)}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Party size"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                          {booking.numberOfVisitors}
                        </span>
                      }
                    />
                    <DetailRow
                      label="Vehicle"
                      value={
                        booking.vehicleNumber ? (
                          <span className="inline-flex items-center gap-1.5 font-mono">
                            <Car className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                            {booking.vehicleNumber}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <DetailRow label="ID proof" value={booking.idType} />
                  </dl>

                  {/* Gate actions — only what the server said is possible */}
                  <div className="flex flex-col gap-3 sm:flex-row">
                    {result.nextAction === "check-in" ? (
                      <Button
                        size="xl"
                        className="flex-1"
                        loading={committing}
                        disabled={!gate}
                        onClick={() => void commit("check-in")}
                      >
                        <LogIn className="h-5 w-5" />
                        Check in at {gate}
                      </Button>
                    ) : null}

                    {result.nextAction === "check-out" ? (
                      <Button
                        size="xl"
                        variant="secondary"
                        className="flex-1"
                        loading={committing}
                        disabled={!gate}
                        onClick={() => void commit("check-out")}
                      >
                        <LogOut className="h-5 w-5" />
                        Check out at {gate}
                      </Button>
                    ) : null}

                    {!result.nextAction ? (
                      <div className="flex flex-1 items-center gap-2 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                        <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
                        No gate action is available for this booking right now.
                      </div>
                    ) : null}
                  </div>

                  {!result.ok ? (
                    <p className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
                      Refer the visitor to the security desk. Do not admit anyone on a refused
                      pass.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      {!ready ? null : (
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <DoorOpen className="h-3.5 w-3.5" aria-hidden />
          Recording movements at <span className="font-medium text-foreground">{gate}</span>
        </p>
      )}
    </div>
  );
}
