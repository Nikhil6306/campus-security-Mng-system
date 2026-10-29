"use client";

import * as React from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  DoorOpen,
  MapPin,
  Shield,
  UserCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InlineLoader, EmptyState } from "@/components/shared/states";
import { cn } from "@/lib/utils";

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

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const statusVariant: Record<
  string,
  "success" | "secondary" | "warning" | "destructive" | "muted" | "accent"
> = {
  Scheduled: "secondary",
  "In Progress": "success",
  Completed: "muted",
  Cancelled: "destructive",
  "Day Off": "muted",
};

const shiftColor: Record<string, string> = {
  Morning: "border-l-amber-500 bg-amber-50 dark:bg-amber-950/20",
  Evening: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20",
  Night: "border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/20",
  General: "border-l-teal-500 bg-teal-50 dark:bg-teal-950/20",
  "Day Off": "border-l-muted-foreground/30 bg-muted/30",
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

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().slice(0, 10);
}

export default function GuardSchedulePage() {
  const [monday, setMonday] = React.useState(() => getMondayOf(new Date()));
  const [schedule, setSchedule] = React.useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [weekStart, setWeekStart] = React.useState("");
  const [weekEnd, setWeekEnd] = React.useState("");

  const fetchSchedule = React.useCallback(
    (mon: Date) => {
      setLoading(true);
      const weekParam = mon.toISOString().slice(0, 10);
      fetch(`/api/guards/my-schedule?week=${weekParam}`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((envelope) => {
          if (envelope.ok) {
            setSchedule(envelope.data.schedule ?? []);
            setWeekStart(envelope.data.weekStart ?? "");
            setWeekEnd(envelope.data.weekEnd ?? "");
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [],
  );

  React.useEffect(() => {
    fetchSchedule(monday);
  }, [monday, fetchSchedule]);

  const weekDates = getWeekDates(monday);

  const scheduleByDate = React.useMemo(() => {
    const map: Record<string, ScheduleEntry | undefined> = {};
    for (const entry of schedule) {
      map[entry.schedule_date] = entry;
    }
    return map;
  }, [schedule]);

  const goToPrevWeek = () => {
    setMonday((m) => {
      const d = new Date(m);
      d.setDate(d.getDate() - 7);
      return d;
    });
  };

  const goToNextWeek = () => {
    setMonday((m) => {
      const d = new Date(m);
      d.setDate(d.getDate() + 7);
      return d;
    });
  };

  const goToCurrentWeek = () => {
    setMonday(getMondayOf(new Date()));
  };

  const totalDutyDays = schedule.filter(
    (s) => s.shift_type !== "Day Off" && s.status !== "Cancelled",
  ).length;

  const currentWeekMonday = getMondayOf(new Date()).toISOString().slice(0, 10);
  const isCurrentWeek = monday.toISOString().slice(0, 10) === currentWeekMonday;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Weekly Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Your duty assignments for the week
            {weekStart && weekEnd
              ? ` of ${formatShortDate(weekStart)} – ${formatShortDate(weekEnd)}`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevWeek} id="prev-week-btn">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          {!isCurrentWeek && (
            <Button variant="outline" size="sm" onClick={goToCurrentWeek} id="current-week-btn">
              This Week
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={goToNextWeek} id="next-week-btn">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Week summary badge */}
      {!loading && (
        <div className="flex gap-3 text-sm text-muted-foreground">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {totalDutyDays} duty day{totalDutyDays !== 1 ? "s" : ""} this week
          </span>
          {isCurrentWeek && (
            <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
              Current Week
            </span>
          )}
        </div>
      )}

      {/* Schedule grid */}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <InlineLoader label="Loading schedule…" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {weekDates.map((date, i) => {
            const entry = scheduleByDate[date];
            const dayLabel = DAYS[i];
            const today = isToday(date);

            return (
              <div
                key={date}
                className={cn(
                  "rounded-xl border-l-4 p-4 transition-shadow",
                  entry
                    ? shiftColor[entry.shift_type] ?? "border-l-border bg-card"
                    : "border-l-border bg-muted/20",
                  today && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
              >
                {/* Day header */}
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wide",
                        today ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {dayLabel}
                    </p>
                    <p className={cn("text-sm font-bold", today && "text-primary")}>
                      {formatShortDate(date)}
                    </p>
                    {today && (
                      <span className="mt-0.5 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                        TODAY
                      </span>
                    )}
                  </div>
                  {entry && (
                    <Badge variant={statusVariant[entry.status] ?? "secondary"} className="text-[10px]">
                      {entry.status}
                    </Badge>
                  )}
                </div>

                {entry ? (
                  <div className="space-y-2">
                    {/* Shift type */}
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{entry.shift_type} Shift</span>
                    </div>

                    {/* Time */}
                    {entry.duty_start && entry.duty_end && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          {entry.duty_start} – {entry.duty_end}
                        </span>
                      </div>
                    )}

                    {/* Location */}
                    {entry.location && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">{entry.location}</span>
                      </div>
                    )}

                    {/* Supervisor */}
                    {entry.supervisor_name && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UserCheck className="h-3.5 w-3.5" />
                        <span className="truncate">{entry.supervisor_name}</span>
                      </div>
                    )}

                    {/* Notes */}
                    {entry.notes && (
                      <p className="rounded bg-black/5 px-2 py-1 text-[11px] italic text-muted-foreground dark:bg-white/5">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 text-center">
                    <Calendar className="mx-auto h-6 w-6 text-muted-foreground/40" />
                    <p className="mt-1 text-xs text-muted-foreground">No duty scheduled</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <Card className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Shift Legend
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Morning", color: "bg-amber-500" },
            { label: "Evening", color: "bg-orange-500" },
            { label: "Night", color: "bg-indigo-500" },
            { label: "General", color: "bg-teal-500" },
            { label: "Day Off", color: "bg-muted-foreground/30" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-full ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Schedule is managed by the administrator. Contact your supervisor for changes.
        </p>
      </Card>
    </div>
  );
}
