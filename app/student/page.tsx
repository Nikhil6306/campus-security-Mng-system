"use client";

import * as React from "react";
import { CalendarPlus, DoorOpen, LogIn, LogOut, MapPin, Phone, UserCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PortalShell } from "@/components/layout/portal-shell";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { OutingStatusBadge } from "@/components/shared/status-badge";
import { DetailRow, FormField } from "@/components/shared/form-field";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { useAction } from "@/components/providers/use-action";
import { api } from "@/lib/api";
import type { OutingRequest, Student } from "@/lib/types";
import { formatDate, formatDateTime, initials } from "@/lib/utils";
import { validateDate, validateText, type FieldErrors } from "@/lib/validation";

const OUTING_TYPES: OutingRequest["type"][] = ["Day Outing", "Leave", "Home Visit", "Medical"];

type Fields = "type" | "reason" | "fromDate" | "toDate";

function RequestOutingDialog({
  student,
  open,
  onOpenChange,
}: {
  student: Student;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const act = useAction();
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({
    type: "Day Outing" as OutingRequest["type"],
    reason: "",
    fromDate: "",
    toDate: "",
    guardianApproved: false,
  });
  const [errors, setErrors] = React.useState<FieldErrors<Fields>>({});

  React.useEffect(() => {
    if (open) {
      setForm({
        type: "Day Outing",
        reason: "",
        fromDate: "",
        toDate: "",
        guardianApproved: false,
      });
      setErrors({});
    }
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next: FieldErrors<Fields> = {
      reason: validateText(form.reason, "Reason", 10, 300),
      fromDate: validateDate(form.fromDate, "From date"),
      toDate: validateDate(form.toDate, "To date"),
    };
    if (!next.fromDate && !next.toDate && form.toDate < form.fromDate)
      next.toDate = "Return date cannot be before the departure date.";

    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    const created = await act(
      () =>
        api.requestOuting({
          studentId: student.id,
          studentName: student.name,
          type: form.type,
          reason: form.reason.trim(),
          fromDate: form.fromDate,
          toDate: form.toDate,
          guardianApproved: form.guardianApproved,
        }),
      {
        success: "Outing request submitted.",
        description: "The hostel office will review your request.",
        fallback: "Unable to submit your request. Please try again.",
      },
    );
    setBusy(false);
    if (created) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave or outing</DialogTitle>
          <DialogDescription>
            Your request goes to the hostel and welfare office for approval.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
          <FormField id="outing-type" label="Request type" required className="sm:col-span-2">
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm((p) => ({ ...p, type: value as OutingRequest["type"] }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTING_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField id="outing-from" label="From date" required error={errors.fromDate}>
            <Input
              type="date"
              value={form.fromDate}
              onChange={(e) => {
                setForm((p) => ({ ...p, fromDate: e.target.value }));
                setErrors((p) => ({ ...p, fromDate: undefined }));
              }}
              invalid={Boolean(errors.fromDate)}
            />
          </FormField>

          <FormField id="outing-to" label="To date" required error={errors.toDate}>
            <Input
              type="date"
              value={form.toDate}
              onChange={(e) => {
                setForm((p) => ({ ...p, toDate: e.target.value }));
                setErrors((p) => ({ ...p, toDate: undefined }));
              }}
              invalid={Boolean(errors.toDate)}
            />
          </FormField>

          <FormField
            id="outing-reason"
            label="Reason"
            required
            error={errors.reason}
            className="sm:col-span-2"
          >
            <Textarea
              value={form.reason}
              onChange={(e) => {
                setForm((p) => ({ ...p, reason: e.target.value }));
                setErrors((p) => ({ ...p, reason: undefined }));
              }}
              rows={3}
              maxLength={300}
              placeholder="e.g. Medical appointment at the city clinic."
              invalid={Boolean(errors.reason)}
            />
          </FormField>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3.5 sm:col-span-2">
            <div>
              <Label htmlFor="guardian-approved" className="cursor-pointer">
                Guardian has approved
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {student.guardianName} · {student.guardianPhone}
              </p>
            </div>
            <Switch
              id="guardian-approved"
              checked={form.guardianApproved}
              onCheckedChange={(value) => setForm((p) => ({ ...p, guardianApproved: value }))}
            />
          </div>

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StudentPortal() {
  const { session } = useAuth();
  const { db } = useData();
  const [requestOpen, setRequestOpen] = React.useState(false);

  const student =
    db.students.find((s) => s.id === session?.refId) ?? db.students[0];

  const outings = React.useMemo(
    () =>
      db.outings
        .filter((o) => o.studentId === student?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.outings, student?.id],
  );

  const movements = React.useMemo(
    () =>
      db.movements
        .filter((m) => m.personId === student?.id)
        .sort((a, b) => b.at.localeCompare(a.at)),
    [db.movements, student?.id],
  );

  if (!student) {
    return (
      <Card>
        <EmptyState
          icon={UserCheck}
          title="No student record linked"
          description="This demo account is not linked to a student profile."
        />
      </Card>
    );
  }

  const pending = outings.filter((o) => o.status === "Pending").length;
  const approved = outings.filter((o) => o.status === "Approved").length;

  return (
    <>
      {/* Profile */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary"
            aria-hidden
          >
            {initials(student.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{student.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {student.rollNo} · {student.department} · {student.year}
            </p>
          </div>
          <Badge variant={student.onCampus ? "success" : "secondary"} className="ml-auto">
            {student.onCampus ? "On campus" : "Outside campus"}
          </Badge>
        </div>

        <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Student ID" value={student.id} mono />
          <DetailRow
            label="Hostel"
            value={
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {student.hostel} · {student.room}
              </span>
            }
          />
          <DetailRow label="Guardian" value={student.guardianName} />
          <DetailRow
            label="Guardian contact"
            value={
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                {student.guardianPhone}
              </span>
            }
          />
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total requests" value={outings.length} icon={DoorOpen} />
        <StatCard label="Awaiting approval" value={pending} icon={CalendarPlus} tone="warning" />
        <StatCard label="Approved" value={approved} icon={UserCheck} tone="success" />
        <StatCard label="Gate movements" value={movements.length} icon={LogIn} tone="accent" />
      </div>

      {/* Outing requests */}
      <Card>
        <SectionHeader
          title="Leave & outing requests"
          description="Requests you have raised with the hostel office"
          actions={
            <Button size="sm" onClick={() => setRequestOpen(true)}>
              <CalendarPlus className="h-4 w-4" />
              New request
            </Button>
          }
        />
        {outings.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title="No requests yet"
            description="Raise a leave or outing request and track its approval here."
            action={
              <Button size="sm" onClick={() => setRequestOpen(true)}>
                <CalendarPlus className="h-4 w-4" />
                New request
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {outings.map((outing) => (
              <li key={outing.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{outing.type}</p>
                    <OutingStatusBadge status={outing.status} />
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {outing.id}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{outing.reason}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDate(outing.fromDate)} – {formatDate(outing.toDate)}
                  </p>
                </div>
                <Badge
                  variant={outing.guardianApproved ? "success" : "warning"}
                  className="shrink-0"
                >
                  {outing.guardianApproved
                    ? "Guardian approved"
                    : "Guardian approval pending"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Movement history */}
      <Card>
        <SectionHeader title="Entry & exit history" description="Your recorded gate movements" />
        {movements.length === 0 ? (
          <EmptyState
            icon={LogIn}
            title="No movement recorded"
            description="Your campus entries and exits will be listed here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-center gap-3 p-4">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                    movement.direction === "Entry"
                      ? "bg-success/12 text-success"
                      : "bg-muted text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {movement.direction === "Entry" ? (
                    <LogIn className="h-4 w-4" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{movement.direction}</p>
                  <p className="truncate text-xs text-muted-foreground">{movement.gate}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(movement.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RequestOutingDialog student={student} open={requestOpen} onOpenChange={setRequestOpen} />
    </>
  );
}

export default function StudentPage() {
  return (
    <PortalShell
      title="Student Portal"
      subtitle="Your profile, outing requests and campus movement history"
      allow={["student"]}
    >
      <StudentPortal />
    </PortalShell>
  );
}
