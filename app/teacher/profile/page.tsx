"use client";

import * as React from "react";
import { Building2, CalendarRange, DoorClosed, Mail, Phone, UserRound } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { SectionHeader } from "@/components/shared/page-header";
import { DetailRow } from "@/components/shared/form-field";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { useTeacherMeetings } from "@/components/teacher/use-teacher-meetings";
import { api, errorMessage } from "@/lib/api";
import { AVAILABILITY_STATUSES } from "@/lib/types";
import { initials } from "@/lib/utils";

/**
 * The teacher's own record.
 *
 * Contact details and department are maintained by the administration — a
 * teacher reads them here. The one field they own is whether they are currently
 * accepting visitors, which the public booking form reads directly.
 */
export default function TeacherProfilePage() {
  const { session } = useAuth();
  const { db, run } = useData();
  const { requests, todays, upcoming, history } = useTeacherMeetings();

  const teacher = db.teachers.find((t) => t.id === session?.refId);
  const [saving, setSaving] = React.useState(false);

  if (!teacher) {
    return (
      <Card className="p-4">
        <EmptyState
          icon={UserRound}
          title="No staff record linked"
          description="This account is not linked to a teacher record. Contact the administration office."
        />
      </Card>
    );
  }

  async function setStatus(status: string) {
    if (!teacher) return;
    setSaving(true);
    try {
      await run(() =>
        api.updateTeacher(teacher.id, {
          name: teacher.name,
          employeeId: teacher.employeeId,
          email: teacher.email,
          phone: teacher.phone,
          departmentId: teacher.departmentId,
          designation: teacher.designation,
          room: teacher.room,
          availabilityStatus: status,
          active: teacher.active,
        }),
      );
      toast.success("Availability status updated.", { description: status });
    } catch (error) {
      toast.error(errorMessage(error, "Your status could not be updated."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending requests" value={requests.length} icon={UserRound} tone="warning" />
        <StatCard label="Today" value={todays.length} icon={CalendarRange} tone="accent" />
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarRange} />
        <StatCard label="Completed" value={history.length} icon={CalendarRange} tone="success" />
      </div>

      <Card>
        <SectionHeader title="Your profile" description="Maintained by the administration office" />

        <div className="space-y-6 p-4">
          <div className="flex items-center gap-4">
            <span
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary"
              aria-hidden
            >
              {initials(teacher.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{teacher.name}</p>
              <p className="truncate text-sm text-muted-foreground">{teacher.designation}</p>
              <Badge variant={teacher.active ? "success" : "muted"} className="mt-1.5">
                {teacher.active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <DetailRow label="Employee ID" value={teacher.employeeId} mono />
            <DetailRow
              label="Department"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {teacher.department}
                </span>
              }
            />
            <DetailRow
              label="Email"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {teacher.email}
                </span>
              }
            />
            <DetailRow
              label="Phone"
              value={
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {teacher.phone}
                </span>
              }
            />
            <DetailRow
              label="Office"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <DoorClosed className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  {teacher.room || "—"}
                </span>
              }
            />
            <DetailRow label="Signed in as" value={session?.email} />
          </dl>

          <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            To correct your name, department, office or contact details, contact the administration
            office — these are managed centrally so the visitor directory stays accurate.
          </p>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Accepting visitors"
          description="Shown on the public booking form"
        />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              You are currently{" "}
              <span className="font-medium">
                {teacher.available ? "available for meetings" : "not accepting new meetings"}
              </span>
              .
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Visitors can only choose you as a host while this is set to Available.
            </p>
          </div>

          <div className="sm:w-56">
            <label htmlFor="teacher-status" className="sr-only">
              Availability status
            </label>
            <Select
              value={teacher.availabilityStatus}
              onValueChange={(v) => void setStatus(v)}
              disabled={saving}
            >
              <SelectTrigger id="teacher-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AVAILABILITY_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button asChild variant="outline">
            <a href="/teacher/availability">
              <CalendarRange className="h-4 w-4" />
              Working hours
            </a>
          </Button>
        </div>
      </Card>
    </>
  );
}
