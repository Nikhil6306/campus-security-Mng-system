"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  Camera,
  CalendarDays,
  Car,
  Clock,
  LogIn,
  LogOut,
  QrCode,
  ScanLine,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrap,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states";
import { FormField } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisitorPhotoPanel, VisitorPhotoThumb } from "@/components/shared/visitor-photo";
import { useVisitActions } from "@/components/admin/visit-actions";
import { useData } from "@/components/providers/data-provider";
import { getGates, getVisitRequest, getVisitorsInside } from "@/lib/selectors";
import type { VisitRequest } from "@/lib/types";
import {
  cn,
  durationBetween,
  formatClock,
  formatDate,
  formatTime,
} from "@/lib/utils";

/**
 * Placeholder for camera-based pass scanning.
 *
 * Camera access is intentionally not implemented in this frontend build, so
 * the frame is presented as an illustration and the manual lookup beside it is
 * the working path.
 */
export function ScanPanel({ onUseManual }: { onUseManual: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="relative aspect-square w-full max-w-[230px] overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/40">
        <div className="absolute inset-0 flex items-center justify-center">
          <QrCode className="h-16 w-16 text-muted-foreground/30" aria-hidden />
        </div>
        {/* Corner brackets */}
        {[
          "left-3 top-3 border-l-2 border-t-2",
          "right-3 top-3 border-r-2 border-t-2",
          "bottom-3 left-3 border-b-2 border-l-2",
          "bottom-3 right-3 border-b-2 border-r-2",
        ].map((position) => (
          <span
            key={position}
            className={cn("absolute h-6 w-6 rounded-sm border-primary/60", position)}
            aria-hidden
          />
        ))}
        <span
          className="absolute inset-x-4 top-0 h-0.5 animate-scan-line bg-accent/70"
          aria-hidden
        />
      </div>

      <div className="space-y-1">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold">
          <ScanLine className="h-4 w-4 text-primary" aria-hidden />
          Scan Visitor Pass
        </p>
        <p className="mx-auto max-w-[260px] text-xs leading-relaxed text-muted-foreground">
          Open the scanning station to use this device&rsquo;s camera, or look the booking up by
          reference below.
        </p>
      </div>

      <Button asChild size="sm" className="w-full max-w-[230px]">
        <Link href="/security/scan">
          <ScanLine className="h-4 w-4" />
          Open scanning station
        </Link>
      </Button>

      <Button variant="outline" size="sm" onClick={onUseManual}>
        <Camera className="h-4 w-4" />
        Enter booking ID instead
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function GateLookupPanel({
  size = "default",
}: {
  size?: "default" | "large";
}) {
  const { db, ready } = useData();
  const actions = useVisitActions();
  const gates = React.useMemo(() => getGates(db), [db]);

  const [bookingId, setBookingId] = React.useState("");
  const [gate, setGate] = React.useState<string>(gates[0]);
  const [record, setRecord] = React.useState<VisitRequest | null>(null);
  const [error, setError] = React.useState<string>();
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Keep the panel in step with the store after a check-in / check-out.
  React.useEffect(() => {
    if (!record) return;
    const latest = db.visitRequests.find((v) => v.id === record.id);
    if (latest && latest !== record) setRecord(latest);
  }, [db.visitRequests, record]);

  const lookup = (event: React.FormEvent) => {
    event.preventDefault();
    const id = bookingId.trim().toUpperCase();
    if (!id) {
      setError("Enter a booking ID to verify the pass.");
      setRecord(null);
      return;
    }
    if (!ready) {
      setError("Still loading records — try again in a moment.");
      return;
    }

    const found = getVisitRequest(db, id);
    if (!found) {
      setError(`No booking found for ${id}.`);
      setRecord(null);
      return;
    }
    setError(undefined);
    setRecord(found);
  };

  const clear = () => {
    setRecord(null);
    setBookingId("");
    setError(undefined);
    inputRef.current?.focus();
  };

  const large = size === "large";

  return (
    <div className={cn("space-y-4", large ? "p-5" : "p-4")}>
      <form onSubmit={lookup} noValidate className="space-y-3">
        <FormField
          id="gate-booking-id"
          label="Enter Booking ID"
          error={error}
          hint="Printed on the visitor pass, e.g. DSVV-VIS-2026-000124"
        >
          <Input
            ref={inputRef}
            value={bookingId}
            onChange={(e) => {
              setBookingId(e.target.value);
              setError(undefined);
            }}
            placeholder="DSVV-VIS-2026-000124"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "font-mono uppercase placeholder:font-sans placeholder:normal-case",
              large && "h-14 text-lg",
            )}
            invalid={Boolean(error)}
          />
        </FormField>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="sm:w-44">
            <label htmlFor="gate-picker" className="sr-only">
              Gate
            </label>
            <Select value={gate} onValueChange={setGate}>
              <SelectTrigger id="gate-picker" className={cn(large && "h-12")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {gates.map((g: string) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="flex-1" size={large ? "xl" : "default"}>
            <Search className="h-4 w-4" />
            Verify pass
          </Button>
        </div>
      </form>

      {record ? (
        <div className="animate-fade-in space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-3">
            {/* Identity first: the gate confirms the face before anything else
                on this panel matters. */}
            <VisitorPhotoPanel
              photoUrl={record.photoUrl}
              name={record.fullName}
              caption={record.id}
              frameClassName={cn("h-20 w-16", large && "h-24 w-20 sm:h-28 sm:w-24")}
            />
            <div className="min-w-0 flex-1">
              <p className={cn("truncate font-semibold", large ? "text-lg" : "text-base")}>
                {record.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {record.visitorType} · {record.organization}
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{record.id}</p>
            </div>
            <StatusBadge status={record.status} />
          </div>

          <Separator />

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0">
                <dt className="sr-only">Host</dt>
                <dd className="truncate font-medium">{record.hostName}</dd>
                <dd className="truncate text-xs text-muted-foreground">{record.department}</dd>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <dd>
                {record.numberOfVisitors} visitor{record.numberOfVisitors === 1 ? "" : "s"}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <dd>{formatDate(record.visitDate)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <dd>{formatTime(record.visitTime)}</dd>
            </div>
            {record.vehicleRequired ? (
              <div className="col-span-2 flex items-center gap-2">
                <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <dd className="font-mono text-xs">{record.vehicleNumber}</dd>
              </div>
            ) : null}
            {record.checkInAt ? (
              <div className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
                <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <dd>
                  Checked in {formatClock(record.checkInAt)} at {record.gate} ·{" "}
                  {durationBetween(record.checkInAt, record.checkOutAt)} on campus
                </dd>
              </div>
            ) : null}
          </dl>

          {record.status === "Pending" || record.status === "Rejected" || record.status === "Cancelled" ? (
            <div
              role="alert"
              className="flex gap-2.5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                Entry not permitted — this booking is {record.status.toLowerCase()}.
                {record.status === "Pending"
                  ? " Approval is required before the visitor can be admitted."
                  : ""}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            {record.status === "Approved" && (
              <Button
                variant="success"
                size={large ? "xl" : "default"}
                className="flex-1"
                onClick={() => actions.checkIn(record, gate)}
              >
                <LogIn className="h-4 w-4" />
                Check In
              </Button>
            )}

            {record.status === "Checked In" && (
              <Button
                size={large ? "xl" : "default"}
                className="flex-1"
                onClick={() => actions.checkOut(record, gate)}
              >
                <LogOut className="h-4 w-4" />
                Check Out
              </Button>
            )}

            {record.status === "Checked Out" && (
              <div className="flex flex-1 items-center justify-center rounded-md border border-border bg-card px-4 py-2.5 text-sm text-muted-foreground">
                Visit completed at {formatClock(record.checkOutAt)}
              </div>
            )}

            <Button asChild variant="outline" size={large ? "xl" : "default"}>
              <Link href={`/visitor/pass/${record.id}`} target="_blank">
                <QrCode className="h-4 w-4" />
                Pass
              </Link>
            </Button>
            <Button variant="ghost" size={large ? "xl" : "default"} onClick={clear}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function InsideCampusTable({ compact = false }: { compact?: boolean }) {
  const { db } = useData();
  const actions = useVisitActions();
  const gates = React.useMemo(() => getGates(db), [db]);
  const inside = React.useMemo(() => getVisitorsInside(db), [db]);

  if (inside.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No active visitors inside campus"
        description="Visitors appear here as soon as they are checked in at a gate."
      />
    );
  }

  return (
    <TableWrap>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="min-w-[190px]">Visitor</TableHead>
            <TableHead className="min-w-[150px]">Host</TableHead>
            {!compact && <TableHead className="min-w-[110px]">Gate</TableHead>}
            <TableHead className="min-w-[100px]">Since</TableHead>
            <TableHead className="min-w-[100px]">Duration</TableHead>
            {!compact && <TableHead className="min-w-[110px]">Vehicle</TableHead>}
            <TableHead className="min-w-[120px] text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inside.map((record) => (
            <TableRow key={record.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  {/* Who is on campus right now, with the face on file. */}
                  <VisitorPhotoThumb
                    photoUrl={record.photoUrl}
                    name={record.fullName}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{record.fullName}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {record.id} · {record.badgeNumber ?? "no badge"}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <p className="truncate text-sm">{record.hostName}</p>
                <p className="truncate text-xs text-muted-foreground">{record.department}</p>
              </TableCell>
              {!compact && (
                <TableCell>
                  <Badge variant="outline" size="sm">
                    {record.gate ?? "—"}
                  </Badge>
                </TableCell>
              )}
              <TableCell className="whitespace-nowrap text-sm">
                {formatClock(record.checkInAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                {durationBetween(record.checkInAt)}
              </TableCell>
              {!compact && (
                <TableCell className="font-mono text-xs">
                  {record.vehicleRequired ? record.vehicleNumber : "—"}
                </TableCell>
              )}
              <TableCell className="text-right">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => actions.checkOut(record, record.gate ?? gates[0])}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Check-Out
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableWrap>
  );
}
