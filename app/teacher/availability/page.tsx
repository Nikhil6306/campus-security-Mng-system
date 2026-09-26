"use client";

import * as React from "react";
import { CalendarOff, CalendarRange, Clock, Plus, Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { SectionHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { EmptyState, InlineLoader } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { api, errorMessage, fieldErrors } from "@/lib/api";
import type { TeacherAvailability } from "@/lib/types";
import { formatDate, todayISO } from "@/lib/utils";

/**
 * Working pattern.
 *
 * This is what the public booking form offers visitors: the slot grid on
 * `/visitor/book` is generated from these days, hours and slot length, and a
 * blocked date removes that day entirely. Narrowing the window can strand
 * bookings that were already taken, so the server reports those back and they
 * are shown rather than silently dropped.
 */

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 7, label: "Sun" },
];

const SLOT_LENGTHS = [15, 20, 30, 45, 60, 90];

export default function TeacherAvailabilityPage() {
  const { session } = useAuth();
  const { db, run } = useData();

  const teacherId = session?.refId ?? db.teachers[0]?.id;

  const [draft, setDraft] = React.useState<TeacherAvailability | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [blockDate, setBlockDate] = React.useState("");
  const [stranded, setStranded] = React.useState<string[]>([]);
  const [confirmNarrow, setConfirmNarrow] = React.useState(false);

  React.useEffect(() => {
    if (!teacherId) return;
    let cancelled = false;
    api
      .availability(teacherId)
      .then((data) => {
        if (!cancelled) setDraft(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Your availability could not be loaded.");
      });
    return () => {
      cancelled = true;
    };
  }, [teacherId]);

  if (!teacherId) {
    return (
      <Card className="p-4">
        <EmptyState
          icon={CalendarRange}
          title="No staff record linked"
          description="This account is not linked to a teacher record, so there is no availability to configure."
        />
      </Card>
    );
  }

  if (!draft) return <InlineLoader label="Loading your availability…" />;

  const set = <K extends keyof TeacherAvailability>(key: K, value: TeacherAvailability[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const toggleDay = (day: number) => {
    const days = draft.days.includes(day)
      ? draft.days.filter((d) => d !== day)
      : [...draft.days, day].sort((a, b) => a - b);
    set("days", days);
  };

  const addBlockedDate = () => {
    if (!blockDate) return;
    if (draft.blocked.includes(blockDate)) {
      toast.error("That date is already blocked.");
      return;
    }
    set("blocked", [...draft.blocked, blockDate].sort());
    setBlockDate("");
  };

  async function save() {
    setSaving(true);
    setErrors({});
    try {
      const result = await run(() =>
        api.saveAvailability(teacherId!, {
          days: draft!.days,
          startTime: draft!.startTime,
          endTime: draft!.endTime,
          slotMinutes: draft!.slotMinutes,
          blocked: draft!.blocked,
        }),
      );
      setDraft(result.availability);
      setStranded(result.stranded);
      if (result.stranded.length) {
        toast.warning("Availability saved, with bookings outside the new window.", {
          description: `${result.stranded.length} existing booking(s) now fall outside your hours.`,
        });
      } else {
        toast.success("Availability saved.", {
          description: "The visitor booking form now offers these slots.",
        });
      }
    } catch (error) {
      const details = fieldErrors(error);
      const message = errorMessage(error, "Your availability could not be saved.");
      setErrors(Object.keys(details).length ? details : { form: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Card>
        <SectionHeader
          title="Working pattern"
          description="Visitors can only book slots inside this window"
          actions={
            <Button onClick={() => setConfirmNarrow(true)} loading={saving}>
              <Save className="h-4 w-4" />
              Save availability
            </Button>
          }
        />

        <div className="space-y-6 p-4">
          {errors.form ? (
            <div
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
            >
              {errors.form}
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Working days</legend>
            {errors.days ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {errors.days}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const active = draft.days.includes(day.value);
                return (
                  <Button
                    key={day.value}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    aria-pressed={active}
                    onClick={() => toggleDay(day.value)}
                    className="min-w-[64px]"
                  >
                    {day.label}
                  </Button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="avail-start" label="Day starts" required error={errors.startTime}>
              <Input
                type="time"
                value={draft.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </FormField>

            <FormField id="avail-end" label="Day ends" required error={errors.endTime}>
              <Input
                type="time"
                value={draft.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </FormField>

            <div className="space-y-1.5">
              <Label htmlFor="avail-slot">Meeting length</Label>
              <Select
                value={String(draft.slotMinutes)}
                onValueChange={(v) => set("slotMinutes", Number(v))}
              >
                <SelectTrigger id="avail-slot">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_LENGTHS.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.slotMinutes ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {errors.slotMinutes}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <Clock className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            Campus visiting hours also apply. A slot is offered only when it falls inside both
            your pattern and the campus window ({db.settings.visitingHoursFrom}–
            {db.settings.visitingHoursTo}).
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader
          title="Blocked dates"
          description="Days you are unavailable — leave, travel, examinations"
        />

        <div className="space-y-4 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="sm:w-56">
              <Label htmlFor="avail-block">Add a date</Label>
              <Input
                id="avail-block"
                type="date"
                min={todayISO()}
                value={blockDate}
                onChange={(e) => setBlockDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <Button variant="outline" onClick={addBlockedDate} disabled={!blockDate}>
              <Plus className="h-4 w-4" />
              Block date
            </Button>
          </div>

          {draft.blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No blocked dates. Visitors can book on any of your working days.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {draft.blocked.map((date) => (
                <li key={date}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 py-1 pl-3 pr-1 text-sm">
                    <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    {formatDate(date)}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Unblock ${formatDate(date)}`}
                      onClick={() =>
                        set(
                          "blocked",
                          draft.blocked.filter((d) => d !== date),
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {stranded.length > 0 ? (
        <Card>
          <SectionHeader
            title="Bookings outside your new hours"
            description="These were already accepted — reschedule or keep them"
          />
          <ul className="divide-y divide-border">
            {stranded.map((id) => (
              <li key={id} className="flex items-center gap-3 p-4">
                <Badge variant="warning">Outside hours</Badge>
                <span className="font-mono text-sm">{id}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ConfirmDialog
        open={confirmNarrow}
        onOpenChange={setConfirmNarrow}
        title="Save your availability?"
        description="The visitor booking form will immediately start offering these slots. Bookings already accepted are not cancelled — any that fall outside the new window are listed for you to reschedule."
        confirmLabel="Save availability"
        onConfirm={() => void save()}
      />
    </>
  );
}
