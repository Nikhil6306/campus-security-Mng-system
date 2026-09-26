"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileSearch,
  LogIn,
  LogOut,
  MessagesSquare,
  QrCode,
  Search,
  Send,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DetailRow, FormField } from "@/components/shared/form-field";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { api, errorMessage, type BookingStatusResult } from "@/lib/api";
import { BOOK_PATH } from "@/lib/dsvv";
import { BOOKING_REF_HINT, BOOKING_REF_PATTERN, type VisitStatus } from "@/lib/types";
import { cn, formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { validateMobile, type FieldErrors } from "@/lib/validation";

type Fields = "bookingId" | "mobile";

/**
 * Visitor-facing status trail.
 *
 * Built from the redacted view the server returns, so a visitor sees their own
 * progress and nothing about anyone else's visit.
 */
function buildTimeline(record: BookingStatusResult["booking"]) {
  const rejected = record.status === "Rejected";
  const cancelled = record.status === "Cancelled";

  return [
    {
      label: "Request submitted",
      at: formatDateTime(record.createdAt),
      icon: Send,
      done: true,
    },
    {
      label: rejected ? "Request rejected" : "Host approval · pass issued",
      at: record.decidedAt ? formatDateTime(record.decidedAt) : "Awaiting decision",
      icon: rejected ? XCircle : CheckCircle2,
      done: Boolean(record.decidedAt),
      tone: rejected ? ("destructive" as const) : undefined,
      hidden: cancelled,
    },
    {
      label: "Checked in at gate",
      at: record.checkInAt
        ? `${formatDateTime(record.checkInAt)}${record.gate ? ` · ${record.gate}` : ""}`
        : "Not yet",
      icon: LogIn,
      done: Boolean(record.checkInAt),
      hidden: rejected || cancelled,
    },
    {
      label: "Meeting in progress",
      at: record.meetingStartedAt ? formatDateTime(record.meetingStartedAt) : "Not yet",
      icon: MessagesSquare,
      done: Boolean(record.meetingStartedAt),
      hidden: rejected || cancelled,
    },
    {
      label: "Checked out",
      at: record.checkOutAt ? formatDateTime(record.checkOutAt) : "Not yet",
      icon: LogOut,
      done: Boolean(record.checkOutAt),
      hidden: rejected || cancelled,
    },
  ].filter((item) => !item.hidden);
}

const PASS_VISIBLE: string[] = ["Approved", "Checked In", "Meeting In Progress", "Checked Out"];

export function BookingStatusLookup() {
  const params = useSearchParams();

  const [bookingId, setBookingId] = React.useState(params.get("id") ?? "");
  const [mobile, setMobile] = React.useState(params.get("mobile") ?? "");
  const [errors, setErrors] = React.useState<FieldErrors<Fields>>({});
  const [result, setResult] = React.useState<BookingStatusResult | null>(null);
  const [notice, setNotice] = React.useState<string>();
  const [searched, setSearched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const autoRan = React.useRef(false);

  /**
   * The lookup happens on the server: it needs both the reference and the
   * mobile number the booking was made with, and answers with a redacted view.
   * Nothing about the booking exists in this browser until it replies.
   */
  const lookup = React.useCallback(async (id: string, phone: string) => {
    setBusy(true);
    setNotice(undefined);
    try {
      const found = await api.bookingStatus(id.trim().toUpperCase(), phone.replace(/[\s-]/g, ""));
      setResult(found);
    } catch (error) {
      setResult(null);
      setNotice(errorMessage(error, "We could not look up that booking. Please try again."));
    } finally {
      setBusy(false);
      setSearched(true);
    }
  }, []);

  // Arriving from the confirmation screen: the query string already holds a
  // valid pair, so run the lookup once and show the visitor their booking.
  React.useEffect(() => {
    if (autoRan.current) return;
    const id = params.get("id");
    const phone = params.get("mobile");
    if (id && phone) {
      autoRan.current = true;
      void lookup(id, phone);
    }
  }, [params, lookup]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const next: FieldErrors<Fields> = {};
    if (!bookingId.trim()) next.bookingId = "Booking ID is required.";
    else if (!BOOKING_REF_PATTERN.test(bookingId.trim()))
      next.bookingId = `Booking IDs look like ${BOOKING_REF_HINT}.`;
    next.mobile = validateMobile(mobile);

    setErrors(next);
    if (next.bookingId || next.mobile) return;

    void lookup(bookingId, mobile);
  };

  const booking = result?.booking;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[360px_1fr] lg:items-start">
      <Card className="lg:sticky lg:top-24">
        <CardContent className="p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-base font-semibold">Find your booking</h2>
            <p className="text-sm text-muted-foreground">
              Use the booking ID from your confirmation and the mobile number you booked with.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <FormField id="status-booking-id" label="Booking ID" required error={errors.bookingId}>
              <Input
                value={bookingId}
                onChange={(e) => {
                  setBookingId(e.target.value);
                  setErrors((p) => ({ ...p, bookingId: undefined }));
                }}
                placeholder={BOOKING_REF_HINT}
                autoComplete="off"
                spellCheck={false}
                className="font-mono uppercase placeholder:font-sans"
                invalid={Boolean(errors.bookingId)}
              />
            </FormField>

            <FormField id="status-mobile" label="Mobile Number" required error={errors.mobile}>
              <Input
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value.replace(/[^\d\s-]/g, ""));
                  setErrors((p) => ({ ...p, mobile: undefined }));
                }}
                placeholder="9876500011"
                inputMode="numeric"
                maxLength={13}
                autoComplete="tel"
                invalid={Boolean(errors.mobile)}
              />
            </FormField>

            <Button type="submit" className="w-full" loading={busy}>
              <Search className="h-4 w-4" />
              Check Status
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground">
            We ask for both the reference and the mobile number so a reference alone reveals
            nothing, and lookups are rate limited.
          </p>
        </CardContent>
      </Card>

      <div className="min-w-0">
        {!searched && (
          <Card>
            <EmptyState
              icon={FileSearch}
              title="No booking looked up yet"
              description="Enter your booking ID and mobile number to see the current status of your visit request."
            />
          </Card>
        )}

        {searched && !booking && (
          <Card>
            <EmptyState
              icon={XCircle}
              title="No matching booking found"
              description={
                notice ??
                "Check that the booking ID and mobile number match the ones used at the time of booking."
              }
              action={
                <Button asChild variant="outline" size="sm">
                  <Link href={BOOK_PATH}>Create a new booking</Link>
                </Button>
              }
            />
          </Card>
        )}

        {booking && result ? (
          <Card className="animate-fade-in">
            <CardContent className="space-y-6 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="section-label">Booking</p>
                  <p className="font-mono text-lg font-semibold tracking-tight">{booking.id}</p>
                </div>
                <StatusBadge status={booking.status as VisitStatus} />
              </div>

              <Separator />

              <dl className="grid gap-5 sm:grid-cols-2">
                <DetailRow label="Visitor name" value={booking.fullName} />
                <DetailRow label="Visitor type" value={booking.visitorType} />
                <DetailRow label="Host" value={booking.hostName} />
                <DetailRow label="Department" value={booking.department} />
                <DetailRow label="Purpose" value={booking.purpose} />
                <DetailRow
                  label="Visit date"
                  value={
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {formatDate(booking.visitDate)}
                    </span>
                  }
                />
                <DetailRow
                  label="Visit time"
                  value={
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {formatTime(booking.visitTime)} · {booking.expectedDuration}
                    </span>
                  }
                />
                <DetailRow label="Number of visitors" value={booking.numberOfVisitors} />
                <DetailRow label="Submitted on" value={formatDateTime(booking.createdAt)} />
                {booking.vehicleNumber ? (
                  <DetailRow label="Vehicle" value={booking.vehicleNumber} mono />
                ) : null}
                {booking.badgeNumber && booking.status !== "Rejected" ? (
                  <DetailRow label="Badge" value={booking.badgeNumber} mono />
                ) : null}
              </dl>

              {booking.rejectionReason ? (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/[0.08] p-4"
                >
                  <p className="text-sm font-semibold text-destructive">Reason for rejection</p>
                  <p className="mt-1 text-sm text-foreground/80">{booking.rejectionReason}</p>
                </div>
              ) : null}

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="section-label mb-4">Approval &amp; movement</p>
                <ol className="space-y-4">
                  {buildTimeline(booking).map((item) => (
                    <li key={item.label} className="flex gap-3">
                      <span
                        className={cn(
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                          item.done && item.tone === "destructive"
                            ? "border-destructive/30 bg-destructive/10 text-destructive"
                            : item.done
                              ? "border-success/30 bg-success/10 text-success"
                              : "border-border bg-card text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        <item.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.at}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                {result.timeline.length > 0 ? (
                  <ul className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    {result.timeline.map((entry, index) => (
                      <li key={`${entry.at}-${index}`}>
                        {entry.direction === "In" ? "Entered" : "Exited"} via {entry.gate} ·{" "}
                        {formatDateTime(entry.at)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                {PASS_VISIBLE.includes(booking.status) ? (
                  <Button asChild>
                    <Link
                      href={`/visitor/pass/${booking.id}?mobile=${encodeURIComponent(
                        mobile.replace(/[\s-]/g, ""),
                      )}`}
                    >
                      <QrCode className="h-4 w-4" />
                      View Visitor Pass
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="ghost">
                  <Link href={BOOK_PATH}>
                    Book another visit
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
