"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Clock, Plus, Save, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { InlineLoader } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SecurityGuard } from "@/lib/types";

interface ScheduleEntry {
  id: string;
  guard_id: string;
  schedule_date: string;
  shift_type: "Morning" | "Evening" | "Night" | "General" | "Day Off";
  duty_start: string | null;
  duty_end: string | null;
  location: string;
  supervisor_name: string;
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled" | "Day Off";
  notes: string | null;
}

interface GuardScheduleDialogProps {
  guard: SecurityGuard;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHIFTS = ["Morning", "Evening", "Night", "General", "Day Off"] as const;

const SHIFT_DEFAULTS: Record<string, { start: string; end: string }> = {
  Morning: { start: "06:00", end: "14:00" },
  Evening: { start: "14:00", end: "22:00" },
  Night: { start: "22:00", end: "06:00" },
  General: { start: "09:00", end: "17:00" },
  "Day Off": { start: "", end: "" },
};

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const shiftColor: Record<string, string> = {
  Morning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  Evening: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  Night: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  General: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "Day Off": "bg-muted text-muted-foreground",
};

export function GuardScheduleDialog({ guard, open, onOpenChange }: GuardScheduleDialogProps) {
  const [monday, setMonday] = React.useState(() => getMondayOf(new Date()));
  const [schedule, setSchedule] = React.useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [editingDate, setEditingDate] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<ScheduleEntry>>({});

  const weekDates = getWeekDates(monday);

  const fetchSchedule = React.useCallback(
    (mon: Date) => {
      if (!guard.id) return;
      setLoading(true);
      const from = mon.toISOString().slice(0, 10);
      const end = new Date(mon);
      end.setDate(end.getDate() + 6);
      const to = end.toISOString().slice(0, 10);

      fetch(`/api/guards/schedule?guardId=${guard.id}&from=${from}&to=${to}`, {
        credentials: "same-origin",
      })
        .then((r) => r.json())
        .then((env) => {
          if (env.ok) setSchedule(env.data.schedule ?? []);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [guard.id],
  );

  React.useEffect(() => {
    if (open) fetchSchedule(monday);
  }, [open, monday, fetchSchedule]);

  const scheduleByDate = React.useMemo(() => {
    const map: Record<string, ScheduleEntry | undefined> = {};
    for (const e of schedule) map[e.schedule_date] = e;
    return map;
  }, [schedule]);

  function openEdit(date: string) {
    const existing = scheduleByDate[date];
    if (existing) {
      setEditForm({
        shift_type: existing.shift_type,
        duty_start: existing.duty_start ?? "",
        duty_end: existing.duty_end ?? "",
        location: existing.location,
        supervisor_name: existing.supervisor_name,
        status: existing.status,
        notes: existing.notes ?? "",
      });
    } else {
      setEditForm({
        shift_type: guard.shift as ScheduleEntry["shift_type"],
        duty_start: guard.shiftStart,
        duty_end: guard.shiftEnd,
        location: guard.assignedGate,
        supervisor_name: "",
        status: "Scheduled",
        notes: "",
      });
    }
    setEditingDate(date);
  }

  async function saveEntry(date: string) {
    setSaving(date);
    try {
      const response = await fetch("/api/guards/schedule", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardId: guard.id,
          scheduleDate: date,
          shiftType: editForm.shift_type,
          dutyStart: editForm.duty_start || null,
          dutyEnd: editForm.duty_end || null,
          location: editForm.location ?? "",
          supervisorName: editForm.supervisor_name ?? "",
          status: editForm.status ?? "Scheduled",
          notes: editForm.notes || null,
        }),
      });
      const env = await response.json();
      if (!env.ok) throw new Error(env.error?.message ?? "Failed to save");
      toast.success("Schedule entry saved.");
      setEditingDate(null);
      fetchSchedule(monday);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Schedule — {guard.fullName}</DialogTitle>
          <DialogDescription>
            Assign duty shifts for each day. Guards can view but not change their schedule.
          </DialogDescription>
        </DialogHeader>

        {/* Week navigation */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date(monday);
              d.setDate(d.getDate() - 7);
              setMonday(d);
            }}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Button>
          <p className="text-sm font-medium">
            {formatDate(weekDates[0])} – {formatDate(weekDates[6])}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date(monday);
              d.setDate(d.getDate() + 7);
              setMonday(d);
            }}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <InlineLoader label="Loading schedule…" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {weekDates.map((date, i) => {
              const entry = scheduleByDate[date];
              const isEditing = editingDate === date;
              const isSaving = saving === date;
              const today = date === new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={date}
                  className={cn(
                    "rounded-xl border border-border bg-card p-3 transition-shadow",
                    today && "ring-2 ring-primary ring-offset-1",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className={cn("text-xs font-semibold uppercase", today && "text-primary")}>
                        {DAYS[i]}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
                    </div>
                    {!isEditing && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openEdit(date)}
                        title="Assign duty"
                      >
                        {entry ? (
                          <Clock className="h-3.5 w-3.5" />
                        ) : (
                          <Plus className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <select
                        className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                        value={editForm.shift_type ?? "Morning"}
                        onChange={(e) => {
                          const shift = e.target.value as ScheduleEntry["shift_type"];
                          const defaults = SHIFT_DEFAULTS[shift];
                          setEditForm((f) => ({
                            ...f,
                            shift_type: shift,
                            duty_start: defaults.start,
                            duty_end: defaults.end,
                            status: shift === "Day Off" ? "Day Off" : f.status,
                          }));
                        }}
                      >
                        {SHIFTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      {editForm.shift_type !== "Day Off" && (
                        <>
                          <input
                            type="time"
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                            value={editForm.duty_start ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, duty_start: e.target.value }))
                            }
                          />
                          <input
                            type="time"
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                            value={editForm.duty_end ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, duty_end: e.target.value }))
                            }
                          />
                          <input
                            type="text"
                            placeholder="Location"
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                            value={editForm.location ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, location: e.target.value }))
                            }
                          />
                        </>
                      )}
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          className="h-6 w-6 flex-1"
                          onClick={() => saveEntry(date)}
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setEditingDate(null)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : entry ? (
                    <div>
                      <span
                        className={cn(
                          "inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold",
                          shiftColor[entry.shift_type],
                        )}
                      >
                        {entry.shift_type}
                      </span>
                      {entry.shift_type !== "Day Off" && (
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {entry.duty_start}–{entry.duty_end}
                        </p>
                      )}
                      {entry.location && (
                        <p className="truncate text-[10px] text-muted-foreground">{entry.location}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-center text-[10px] text-muted-foreground/60">Unassigned</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
