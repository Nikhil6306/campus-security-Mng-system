"use client";

import * as React from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  Eye,
  LogIn,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  QrCode,
  UserX,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { DetailRow, FormField } from "@/components/shared/form-field";
import { VisitorPhotoPanel } from "@/components/shared/visitor-photo";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisitTimeline } from "@/components/admin/visit-timeline";
import { WhatsAppDeliveryList } from "@/components/admin/whatsapp-panel";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage } from "@/lib/api";
import type { WhatsAppMessageRecord } from "@/lib/api";
import { getCheckLogs, getGates } from "@/lib/selectors";
import { STATUS_CODES, type VisitGuest, type VisitRequest } from "@/lib/types";
import { durationBetween, formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { maskAadhaar, validateFutureDate, validateText, validateTime } from "@/lib/validation";

/* ------------------------------------------------------------------ *
 * Shared mutation helpers.
 *
 * Every visit action in the console goes through here, so the toasts read
 * consistently and each one surfaces the server's own message when the
 * transition is refused (already checked in, slot taken, wrong role, …).
 * ------------------------------------------------------------------ */

export function useVisitActions() {
  const { run } = useData();

  return React.useMemo(() => {
    const attempt = async (
      operation: () => Promise<unknown>,
      success: { title: string; description?: string },
      fallback: string,
    ): Promise<boolean> => {
      try {
        await run(operation);
        toast.success(success.title, { description: success.description });
        return true;
      } catch (error) {
        toast.error(errorMessage(error, fallback));
        return false;
      }
    };

    return {
      approve: (record: VisitRequest) =>
        attempt(
          () => api.bookingAction(record.id, "approve"),
          {
            title: "Visitor approved.",
            description: `${record.fullName} — pass issued for ${formatDate(record.visitDate)}.`,
          },
          "Unable to approve this booking. Please try again.",
        ),

      reject: (record: VisitRequest, reason: string) =>
        attempt(
          () => api.bookingAction(record.id, "reject", { reason }),
          { title: "Visit request rejected.", description: `${record.fullName} · ${record.id}` },
          "Unable to reject this booking. Please try again.",
        ),

      reschedule: (record: VisitRequest, visitDate: string, visitTime: string) =>
        attempt(
          () => api.bookingAction(record.id, "reschedule", { visitDate, visitTime }),
          {
            title: "Meeting rescheduled.",
            description: `${formatDate(visitDate)} at ${formatTime(visitTime)} — awaiting re-confirmation.`,
          },
          "Unable to move this booking. Please try again.",
        ),

      cancel: (record: VisitRequest) =>
        attempt(
          () => api.bookingAction(record.id, "cancel"),
          { title: "Booking cancelled.", description: record.id },
          "Unable to cancel this booking. Please try again.",
        ),

      markNoShow: (record: VisitRequest) =>
        attempt(
          () => api.bookingAction(record.id, "no-show"),
          { title: "Recorded as a no-show.", description: record.id },
          "Unable to update this booking. Please try again.",
        ),

      startMeeting: (record: VisitRequest) =>
        attempt(
          () => api.bookingAction(record.id, "start-meeting"),
          { title: "Meeting started.", description: `${record.fullName} with ${record.hostName}.` },
          "Unable to start this meeting. Please try again.",
        ),

      completeMeeting: (record: VisitRequest) =>
        attempt(
          () => api.bookingAction(record.id, "complete-meeting"),
          {
            title: "Meeting marked complete.",
            description: "The visitor can now be checked out at the gate.",
          },
          "Unable to complete this meeting. Please try again.",
        ),

      checkIn: (record: VisitRequest, gate: string) =>
        attempt(
          () => api.checkIn(record.id, gate),
          { title: "Visitor checked in.", description: `${record.fullName} at ${gate}.` },
          "Unable to check this visitor in. Please try again.",
        ),

      checkOut: (record: VisitRequest, gate: string) =>
        attempt(
          () => api.checkOut(record.id, gate),
          {
            title: "Visitor checked out.",
            description: `${record.fullName} — ${durationBetween(record.checkInAt)} on campus.`,
          },
          "Unable to check this visitor out. Please try again.",
        ),
    };
  }, [run]);
}

/* ------------------------------- Dialogs ------------------------------- */

export function RejectDialog({
  record,
  open,
  onOpenChange,
}: {
  record: VisitRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actions = useVisitActions();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(undefined);
    }
  }, [open]);

  if (!record) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validateText(reason, "Reason", 10, 300);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    const ok = await actions.reject(record, reason.trim());
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject visit request</DialogTitle>
          <DialogDescription>
            {record.fullName} · {record.id} · {formatDate(record.visitDate)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField
            id="reject-reason"
            label="Reason for rejection"
            required
            error={error}
            hint="Shared with the visitor on their booking status page."
          >
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError(undefined);
              }}
              placeholder="e.g. Host is unavailable on the requested date. Please rebook after 20 March."
              maxLength={300}
              invalid={Boolean(error)}
              autoFocus
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" loading={busy}>
              <X className="h-4 w-4" />
              Reject request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RescheduleDialog({
  record,
  open,
  onOpenChange,
}: {
  record: VisitRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actions = useVisitActions();
  const [date, setDate] = React.useState("");
  const [time, setTime] = React.useState("");
  const [errors, setErrors] = React.useState<{ date?: string; time?: string }>({});
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open && record) {
      setDate(record.visitDate || "");
      setTime(record.visitTime || "");
      setErrors({});
    }
  }, [open, record]);

  if (!record) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = {
      date: validateFutureDate(date, "New date"),
      time: validateTime(time, "New time"),
    };
    setErrors(next);
    if (next.date || next.time) return;

    setBusy(true);
    const ok = await actions.reschedule(record, date, time);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule meeting</DialogTitle>
          <DialogDescription>
            {record.fullName} with {record.hostName} · currently {formatDate(record.visitDate)} at{" "}
            {formatTime(record.visitTime)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="reschedule-date" label="New date" required error={errors.date}>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                invalid={Boolean(errors.date)}
              />
            </FormField>
            <FormField id="reschedule-time" label="New time" required error={errors.time}>
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                invalid={Boolean(errors.time)}
              />
            </FormField>
          </div>

          <p className="text-xs text-muted-foreground">
            The booking returns to “awaiting confirmation” so the host can accept the new time.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              <CalendarClock className="h-4 w-4" />
              Save new slot
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GateDialog({
  record,
  mode,
  open,
  onOpenChange,
}: {
  record: VisitRequest | null;
  mode: "in" | "out";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const actions = useVisitActions();
  const { db, session } = useGateContext();
  const gates = React.useMemo(() => getGates(db), [db]);
  const [gate, setGate] = React.useState<string>(gates[0]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) setGate(record?.gate ?? session?.gate ?? gates[0]);
  }, [open, record, gates, session]);

  if (!record) return null;

  const confirm = async () => {
    setBusy(true);
    const ok =
      mode === "in"
        ? await actions.checkIn(record, gate)
        : await actions.checkOut(record, gate);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "in" ? "Check in visitor" : "Check out visitor"}</DialogTitle>
          <DialogDescription>
            {record.fullName} · {record.id}
          </DialogDescription>
        </DialogHeader>

        {/* The last screen before a movement is recorded, so the face on file
            is shown next to the details being confirmed. */}
        <div className="flex gap-4 rounded-md border border-border bg-muted/40 p-4">
          <VisitorPhotoPanel
            photoUrl={record.photoUrl}
            name={record.fullName}
            caption={record.id}
            className="shrink-0"
            frameClassName="h-24 w-20"
          />
          <dl className="grid flex-1 grid-cols-2 gap-4">
          <DetailRow label="Host" value={record.hostName} />
          <DetailRow label="Department" value={record.department} />
          <DetailRow label="Visitors" value={record.numberOfVisitors} />
          <DetailRow
            label="Vehicle"
            value={record.vehicleRequired ? record.vehicleNumber : "None"}
            mono={record.vehicleRequired}
          />
          </dl>
        </div>

        <FormField id="gate-select" label="Gate" required>
          <Select value={gate} onValueChange={setGate}>
            <SelectTrigger id="gate-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {gates.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={mode === "in" ? "success" : "default"}
            onClick={confirm}
            loading={busy}
          >
            {mode === "in" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
            {mode === "in" ? "Confirm check-in" : "Confirm check-out"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small helper so the gate dialog can read both snapshot and session. */
function useGateContext() {
  const { db } = useData();
  const { session } = useAuth();
  return { db, session };
}

/**
 * The complete visitor record.
 *
 * Split into the three questions an operator actually asks: who is this, what
 * are they here for, and what has security done about it. The timeline is built
 * from the booking's own stamps, so it can never disagree with the record.
 */
export function VisitDetailDialog({
  record,
  open,
  onOpenChange,
}: {
  record: VisitRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { db } = useData();
  const { isAdmin } = useAuth();
  const logs = React.useMemo(
    () => (record ? getCheckLogs(db, record.id) : []),
    [db, record],
  );

  // The delivery log is admin-only and lives outside the snapshot, so it is
  // fetched when the dialog opens rather than carried on every booking.
  const [messages, setMessages] = React.useState<WhatsAppMessageRecord[]>([]);
  const [retrying, setRetrying] = React.useState<string | null>(null);
  // The accompanying party is fetched on open for the same reason: it is not
  // worth carrying on every booking in the snapshot.
  const [guests, setGuests] = React.useState<VisitGuest[]>([]);
  const bookingId = record?.id;

  const loadMessages = React.useCallback(() => {
    if (!open || !isAdmin || !bookingId) return;
    api
      .whatsappForBooking(bookingId)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [open, isAdmin, bookingId]);

  React.useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  React.useEffect(() => {
    if (!open || !bookingId) {
      setGuests([]);
      return;
    }
    let alive = true;
    api
      .guestsForBooking(bookingId)
      .then((rows) => {
        if (alive) setGuests(rows);
      })
      .catch(() => {
        if (alive) setGuests([]);
      });
    return () => {
      alive = false;
    };
  }, [open, bookingId]);

  async function retryMessage(id: string) {
    setRetrying(id);
    try {
      const result = await api.retryWhatsApp(id);
      toast[result.sent ? "success" : "error"](
        result.sent
          ? result.simulated
            ? "Message re-recorded (simulated — no provider configured)."
            : "Message resent."
          : (result.reason ?? "The message failed again."),
      );
      loadMessages();
    } catch (error) {
      toast.error(errorMessage(error, "That message could not be retried."));
    } finally {
      setRetrying(null);
    }
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            {record.fullName}
            <StatusBadge status={record.status} />
          </DialogTitle>
          <DialogDescription className="font-mono">
            {record.id} · {STATUS_CODES[record.status]} · Visitor {record.visitorId}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1 scrollbar-slim">
          <section aria-labelledby="visitor-identity">
            <h3
              id="visitor-identity"
              className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Visitor
            </h3>
            <div className="flex flex-col gap-4 sm:flex-row">
              <VisitorPhotoPanel
                photoUrl={record.photoUrl}
                name={record.fullName}
                caption={record.id}
                className="shrink-0"
              />
              <dl className="grid flex-1 gap-4 sm:grid-cols-2">
                <DetailRow label="Mobile Number" value={record.mobileNumber || record.mobile} mono />
                <DetailRow
                  label="Aadhaar Card Number"
                  value={maskAadhaar(record.aadhaarNumber || record.idNumber || "")}
                  mono
                />
                <DetailRow
                  label="Car Brought"
                  value={record.hasCar || record.vehicleRequired ? "Yes" : "No"}
                />
                <DetailRow
                  label="Car Number"
                  value={(record.hasCar || record.vehicleRequired) ? (record.carNumber || record.vehicleNumber || "None") : "None"}
                  mono={(record.hasCar || record.vehicleRequired) && Boolean(record.carNumber || record.vehicleNumber)}
                />
                <DetailRow
                  label="Registration Date"
                  value={formatDate(record.createdAt || record.visitDate || "")}
                />
              </dl>
            </div>
          </section>

          {guests.length > 0 ? (
            <>
              <Separator />
              <section aria-labelledby="visit-party">
                <h3
                  id="visit-party"
                  className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  Accompanying visitors ({guests.length})
                </h3>
                <div className="space-y-3">
                  {guests.map((guest) => (
                    <div
                      key={guest.id}
                      className="rounded-md border border-border bg-muted/40 p-3.5"
                    >
                      <p className="text-sm font-medium">
                        Visitor {guest.position} · {guest.fullName}
                      </p>
                      <dl className="mt-2 grid gap-4 sm:grid-cols-3">
                        <DetailRow label="Mobile" value={guest.mobile} mono />
                        <DetailRow label="Relation" value={guest.relation} />
                        {/* Aadhaar is masked here and everywhere else. The full
                            number is never sent to the browser; recovering one
                            is a deliberate, server-side operator action. */}
                        <DetailRow
                          label="Aadhaar"
                          value={maskAadhaar(guest.aadhaarLast4)}
                          mono
                        />
                        {isAdmin ? (
                          <DetailRow
                            label="Address"
                            value={guest.address}
                            className="sm:col-span-3"
                          />
                        ) : null}
                      </dl>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <Separator />

          <section aria-labelledby="visit-details">
            <h3
              id="visit-details"
              className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Visit
            </h3>
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailRow label="Host" value={record.hostName} />
              <DetailRow label="Department" value={record.department} />
              <DetailRow label="Purpose" value={record.purpose} />
              <DetailRow label="Visit date" value={formatDate(record.visitDate)} />
              <DetailRow label="Visit time" value={formatTime(record.visitTime)} />
              <DetailRow label="Duration" value={record.expectedDuration} />
              <DetailRow label="Number of visitors" value={record.numberOfVisitors} />
              <DetailRow
                label="Vehicle"
                value={record.vehicleRequired ? record.vehicleNumber : "Not declared"}
                mono={record.vehicleRequired}
              />
              <DetailRow label="Source" value={record.source} />
              <DetailRow
                label="Purpose details"
                value={record.purposeDetail}
                className="sm:col-span-3"
              />
              <DetailRow label="Message" value={record.notes} className="sm:col-span-3" />
              <DetailRow
                label="Special requirements"
                value={record.specialRequirements}
                className="sm:col-span-3"
              />
            </dl>
          </section>

          <Separator />

          <section aria-labelledby="security-record">
            <h3
              id="security-record"
              className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Security record
            </h3>
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailRow label="Requested on" value={formatDateTime(record.createdAt)} />
              <DetailRow label="Decision" value={formatDateTime(record.decidedAt)} />
              <DetailRow label="Approved by" value={record.decidedBy} />
              <DetailRow label="Checked in" value={formatDateTime(record.checkInAt)} />
              <DetailRow label="Checked in by" value={record.checkedInBy} />
              <DetailRow label="Gate" value={record.gate} />
              <DetailRow label="Checked out" value={formatDateTime(record.checkOutAt)} />
              <DetailRow label="Checked out by" value={record.checkedOutBy} />
              <DetailRow
                label="Time on campus"
                value={
                  record.checkInAt ? durationBetween(record.checkInAt, record.checkOutAt) : "—"
                }
              />
              <DetailRow label="Badge" value={record.badgeNumber} mono />
              <DetailRow label="Rescheduled from" value={record.rescheduledFrom} />
            </dl>
          </section>

          {record.rejectionReason ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/[0.08] p-3.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
                Rejection reason
              </p>
              <p className="mt-1 text-sm">{record.rejectionReason}</p>
            </div>
          ) : null}

          {isAdmin ? (
            <>
              <Separator />

              <section aria-labelledby="whatsapp-delivery">
                <h3
                  id="whatsapp-delivery"
                  className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  WhatsApp delivery
                </h3>
                <dl className="mb-3 grid gap-4 sm:grid-cols-3">
                  <DetailRow
                    label="WhatsApp number"
                    value={
                      record.whatsappNumber
                        ? `${record.whatsappCountryCode ?? "+91"} ${record.whatsappNumber}`
                        : "Not provided"
                    }
                    mono={Boolean(record.whatsappNumber)}
                  />
                </dl>
                <div className="rounded-md border border-border">
                  <WhatsAppDeliveryList
                    messages={messages}
                    onRetry={(id) => void retryMessage(id)}
                    retrying={retrying}
                  />
                </div>
              </section>
            </>
          ) : null}

          <Separator />

          <section aria-labelledby="visit-timeline">
            <h3
              id="visit-timeline"
              className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Timeline
            </h3>
            <VisitTimeline booking={record} logs={logs} />
          </section>
        </div>

        <DialogFooter>
          <Button asChild variant="outline">
            <Link href={`/admin/bookings?q=${encodeURIComponent(record.id)}`}>
              <QrCode className="h-4 w-4" />
              Open in bookings
            </Link>
          </Button>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------- Action controls --------------------------- */

interface VisitRowActionsProps {
  record: VisitRequest;
  onView: (record: VisitRequest) => void;
  onReject: (record: VisitRequest) => void;
  onGate: (record: VisitRequest, mode: "in" | "out") => void;
  onReschedule?: (record: VisitRequest) => void;
}

const DECIDABLE = ["Pending", "Rescheduled"];
const ON_CAMPUS = ["Checked In", "Meeting In Progress"];

/** Compact action set for table rows — only valid transitions are offered. */
export function VisitRowActions({
  record,
  onView,
  onReject,
  onGate,
  onReschedule,
}: VisitRowActionsProps) {
  const actions = useVisitActions();
  const [busy, setBusy] = React.useState(false);

  const guarded = async (operation: () => Promise<boolean>) => {
    setBusy(true);
    await operation();
    setBusy(false);
  };

  return (
    <div className="flex items-center justify-end gap-1">
      {DECIDABLE.includes(record.status) && (
        <>
          <Button
            size="xs"
            variant="success"
            disabled={busy}
            onClick={() => guarded(() => actions.approve(record))}
            aria-label={`Approve visit for ${record.fullName}`}
          >
            <Check className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Approve</span>
          </Button>
          <Button
            size="xs"
            variant="outline"
            onClick={() => onReject(record)}
            aria-label={`Reject visit for ${record.fullName}`}
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reject</span>
          </Button>
        </>
      )}

      {record.status === "Approved" && (
        <Button size="xs" onClick={() => onGate(record, "in")}>
          <LogIn className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Check-In</span>
        </Button>
      )}

      {ON_CAMPUS.includes(record.status) && (
        <Button size="xs" variant="secondary" onClick={() => onGate(record, "out")}>
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Check-Out</span>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${record.fullName}`}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onView(record)}>
            <Eye />
            View details
          </DropdownMenuItem>

          {onReschedule && [...DECIDABLE, "Approved"].includes(record.status) && (
            <DropdownMenuItem onSelect={() => onReschedule(record)}>
              <CalendarClock />
              Reschedule
            </DropdownMenuItem>
          )}

          {record.status === "Checked In" && (
            <DropdownMenuItem onSelect={() => void actions.startMeeting(record)}>
              <MessagesSquare />
              Start meeting
            </DropdownMenuItem>
          )}

          {record.status === "Meeting In Progress" && (
            <DropdownMenuItem onSelect={() => void actions.completeMeeting(record)}>
              <Check />
              Complete meeting
            </DropdownMenuItem>
          )}

          {DECIDABLE.includes(record.status) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void actions.approve(record)}>
                <Check />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem destructive onSelect={() => onReject(record)}>
                <X />
                Reject
              </DropdownMenuItem>
            </>
          )}

          {record.status === "Approved" && (
            <DropdownMenuItem onSelect={() => void actions.markNoShow(record)}>
              <UserX />
              Mark as no-show
            </DropdownMenuItem>
          )}

          {[...DECIDABLE, "Approved"].includes(record.status) && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => void actions.cancel(record)}>
                <X />
                Cancel booking
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Wires the four dialogs used alongside {@link VisitRowActions} and returns
 * the handlers a table needs. Keeps every list page free of dialog plumbing.
 */
export function useVisitDialogs() {
  const [selected, setSelected] = React.useState<VisitRequest | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const [gateOpen, setGateOpen] = React.useState(false);
  const [gateMode, setGateMode] = React.useState<"in" | "out">("in");

  const handlers = React.useMemo(
    () => ({
      onView: (record: VisitRequest) => {
        setSelected(record);
        setDetailOpen(true);
      },
      onReject: (record: VisitRequest) => {
        setSelected(record);
        setRejectOpen(true);
      },
      onReschedule: (record: VisitRequest) => {
        setSelected(record);
        setRescheduleOpen(true);
      },
      onGate: (record: VisitRequest, mode: "in" | "out") => {
        setSelected(record);
        setGateMode(mode);
        setGateOpen(true);
      },
    }),
    [],
  );

  const dialogs = (
    <>
      <VisitDetailDialog record={selected} open={detailOpen} onOpenChange={setDetailOpen} />
      <RejectDialog record={selected} open={rejectOpen} onOpenChange={setRejectOpen} />
      <RescheduleDialog record={selected} open={rescheduleOpen} onOpenChange={setRescheduleOpen} />
      <GateDialog record={selected} mode={gateMode} open={gateOpen} onOpenChange={setGateOpen} />
    </>
  );

  return { handlers, dialogs, selected };
}
