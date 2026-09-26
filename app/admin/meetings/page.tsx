"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  CalendarClock,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, SectionHeader } from "@/components/shared/page-header";
import { EmptyState, InlineLoader } from "@/components/shared/states";
import { MeetingStatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { useVisitActions, useVisitDialogs } from "@/components/admin/visit-actions";
import { useData } from "@/components/providers/data-provider";
import { getMeetings } from "@/lib/selectors";
import type { Meeting } from "@/lib/types";
import { cn, formatDateLong, formatTime, toDateKey, todayISO } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Builds a Monday-first 6×7 grid for the given month. */
function buildMonthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

export default function MeetingsPage() {
  const { db, ready } = useData();
  const actions = useVisitActions();
  const { handlers, dialogs } = useVisitDialogs();

  const [anchor, setAnchor] = React.useState(() => new Date());
  const [selectedDate, setSelectedDate] = React.useState(todayISO());
  const [department, setDepartment] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const meetings = React.useMemo(() => getMeetings(db), [db]);

  const departments = React.useMemo(
    () => [...new Set(meetings.map((m) => m.department))].sort(),
    [meetings],
  );

  const visible = React.useMemo(
    () =>
      meetings.filter((m) => {
        if (department !== "all" && m.department !== department) return false;
        if (status !== "all" && m.meetingStatus !== status) return false;
        return true;
      }),
    [meetings, department, status],
  );

  const byDate = React.useMemo(() => {
    const map = new Map<string, Meeting[]>();
    visible.forEach((m) => {
      const list = map.get(m.date) ?? [];
      list.push(m);
      map.set(m.date, list);
    });
    return map;
  }, [visible]);

  const dayMeetings = byDate.get(selectedDate) ?? [];
  const upcoming = React.useMemo(
    () => visible.filter((m) => m.date > selectedDate).slice(0, 6),
    [visible, selectedDate],
  );

  const grid = React.useMemo(() => buildMonthGrid(anchor), [anchor]);
  const today = todayISO();

  const findRecord = (meeting: Meeting) =>
    db.visitRequests.find((v) => v.id === meeting.visitRequestId);

  const runOn = (meeting: Meeting, fn: (record: NonNullable<ReturnType<typeof findRecord>>) => void) => {
    const record = findRecord(meeting);
    if (record) fn(record);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="Scheduled meetings between visitors and campus staff, drawn from approved and pending bookings."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              const now = new Date();
              setAnchor(now);
              setSelectedDate(toDateKey(now));
            }}
          >
            <CalendarDays className="h-4 w-4" />
            Jump to today
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total meetings"
          value={meetings.length}
          icon={CalendarDays}
          loading={!ready}
        />
        <StatCard
          label="Today"
          value={meetings.filter((m) => m.date === today).length}
          icon={Clock}
          tone="accent"
          loading={!ready}
        />
        <StatCard
          label="Awaiting approval"
          value={meetings.filter((m) => m.meetingStatus === "Requested").length}
          icon={CalendarClock}
          tone="warning"
          href="/admin/requests"
          loading={!ready}
        />
        <StatCard
          label="Upcoming"
          value={meetings.filter((m) => m.date > today).length}
          icon={CalendarDays}
          tone="success"
          loading={!ready}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
        {/* ----------------------------- Calendar ----------------------------- */}
        <Card className="h-fit">
          <div className="flex items-center justify-between gap-2 border-b border-border p-4">
            <h2 className="text-sm font-semibold">
              {anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
            </h2>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous month"
                onClick={() =>
                  setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next month"
                onClick={() =>
                  setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Meeting calendar">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="pb-1 text-center text-[11px] font-semibold uppercase text-muted-foreground"
                >
                  {day}
                </div>
              ))}

              {grid.map((day) => {
                const key = toDateKey(day);
                const count = byDate.get(key)?.length ?? 0;
                const inMonth = day.getMonth() === anchor.getMonth();
                const isToday = key === today;
                const isSelected = key === selectedDate;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    aria-pressed={isSelected}
                    aria-label={`${formatDateLong(key)} — ${count} meeting${count === 1 ? "" : "s"}`}
                    className={cn(
                      "relative flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      !inMonth && "text-muted-foreground/40",
                      inMonth && !isSelected && "hover:bg-secondary",
                      isSelected && "bg-primary text-primary-foreground",
                      !isSelected && isToday && "ring-1 ring-inset ring-primary/50",
                    )}
                  >
                    <span className={cn("tabular-nums", isToday && !isSelected && "font-semibold")}>
                      {day.getDate()}
                    </span>
                    {count > 0 ? (
                      <span
                        className={cn(
                          "absolute bottom-1 h-1 w-1 rounded-full",
                          isSelected ? "bg-primary-foreground" : "bg-accent",
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 border-t border-border p-4">
            <div>
              <label htmlFor="meeting-department" className="sr-only">
                Filter by department
              </label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="meeting-department" className="h-9 text-[13px]">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="meeting-status" className="sr-only">
                Filter by status
              </label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="meeting-status" className="h-9 text-[13px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  {["all", "Requested", "Approved", "Completed", "Rejected", "Cancelled"].map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {value === "all" ? "All statuses" : value}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* ------------------------------ Agenda ------------------------------ */}
        <div className="min-w-0 space-y-6">
          <Card>
            <SectionHeader
              title={formatDateLong(selectedDate)}
              description={`${dayMeetings.length} meeting${dayMeetings.length === 1 ? "" : "s"} scheduled`}
            />

            {!ready ? (
              <InlineLoader label="Loading meetings…" />
            ) : dayMeetings.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No meetings on this date"
                description="Pick another date on the calendar, or check the upcoming list below."
              />
            ) : (
              <ul className="divide-y divide-border">
                {dayMeetings.map((meeting) => (
                  <li
                    key={meeting.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                  >
                    <div className="flex items-center gap-3 sm:w-32 sm:shrink-0">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary"
                        aria-hidden
                      >
                        <Clock className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatTime(meeting.time)}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{meeting.visitorName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {meeting.hostName} · {meeting.department}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Badge variant="secondary" size="sm">
                          {meeting.purpose}
                        </Badge>
                        <Badge variant="outline" size="sm">
                          {meeting.duration}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <MeetingStatusBadge status={meeting.meetingStatus} />

                      {meeting.status === "Pending" && (
                        <>
                          <Button
                            size="xs"
                            variant="success"
                            onClick={() => runOn(meeting, (r) => actions.approve(r))}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => runOn(meeting, handlers.onReject)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Reject
                          </Button>
                        </>
                      )}

                      {["Pending", "Approved"].includes(meeting.status) && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => runOn(meeting, handlers.onReschedule)}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          Reschedule
                        </Button>
                      )}

                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`View meeting with ${meeting.visitorName}`}
                        onClick={() => runOn(meeting, handlers.onView)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <SectionHeader title="Upcoming meetings" description="Next scheduled visits" />
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nothing further scheduled"
                description="Meetings booked for later dates will appear here."
                className="py-10"
              />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((meeting) => (
                  <li key={meeting.id} className="flex items-center gap-3 p-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(meeting.date);
                        setAnchor(new Date(`${meeting.date}T00:00:00`));
                      }}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="truncate text-sm font-medium">{meeting.visitorName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateLong(meeting.date)} · {formatTime(meeting.time)} ·{" "}
                        {meeting.hostName}
                      </p>
                    </button>
                    <MeetingStatusBadge status={meeting.meetingStatus} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {dialogs}
    </div>
  );
}
