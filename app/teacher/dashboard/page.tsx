"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck, CalendarDays, History, Inbox } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { MeetingRow } from "@/components/teacher/meeting-row";
import { useVisitActions, useVisitDialogs } from "@/components/admin/visit-actions";
import { useAuth } from "@/components/providers/auth-provider";
import { useData } from "@/components/providers/data-provider";
import { useTeacherMeetings } from "@/components/teacher/use-teacher-meetings";
import { formatDate, todayISO } from "@/lib/utils";

/**
 * A teacher's landing view: what needs a decision, and what is happening today.
 */
export default function TeacherDashboardPage() {
  const { db } = useData();
  const { session } = useAuth();
  const actions = useVisitActions();
  const { handlers, dialogs } = useVisitDialogs();
  const { requests, todays, upcoming, history, act } = useTeacherMeetings();

  const today = todayISO();
  const teacher = db.teachers.find((t) => t.id === session?.refId);

  return (
    <>
      {teacher ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="font-medium">{teacher.designation}</span>
            <span className="text-muted-foreground">{teacher.department}</span>
            <span className="text-muted-foreground">Room {teacher.room}</span>
            <Badge variant={teacher.available ? "success" : "muted"} className="ml-auto">
              {teacher.available ? "Available for meetings" : "Currently unavailable"}
            </Badge>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending requests"
          value={requests.length}
          icon={Inbox}
          tone={requests.length > 0 ? "warning" : "default"}
          href="/teacher/meetings"
        />
        <StatCard
          label="Today"
          value={todays.length}
          icon={CalendarCheck}
          tone="accent"
          href="/teacher/meetings"
        />
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarDays} />
        <StatCard label="Completed" value={history.length} icon={History} tone="success" />
      </div>

      <Card>
        <SectionHeader
          title="Awaiting your decision"
          description="Visitors who asked to meet you"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/teacher/meetings">All meetings</Link>
            </Button>
          }
        />
        {requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No pending requests"
            description="Visitor requests addressed to you will appear here for approval."
          />
        ) : (
          <ul className="divide-y divide-border">
            {requests.slice(0, 5).map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                actions={{
                  onApprove: () => act(meeting, (record) => actions.approve(record)),
                  onReject: () => act(meeting, handlers.onReject),
                  onReschedule: () => act(meeting, handlers.onReschedule),
                  onView: () => act(meeting, handlers.onView),
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeader title="Today's meetings" description={formatDate(today)} />
        {todays.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Nothing scheduled today"
            description="Meetings booked for today will be listed here."
          />
        ) : (
          <ul className="divide-y divide-border">
            {todays.map((meeting) => (
              <MeetingRow
                key={meeting.id}
                meeting={meeting}
                actions={{
                  onApprove: () => act(meeting, (record) => actions.approve(record)),
                  onReject: () => act(meeting, handlers.onReject),
                  onStart: () => act(meeting, (record) => actions.startMeeting(record)),
                  onComplete: () => act(meeting, (record) => actions.completeMeeting(record)),
                  onView: () => act(meeting, handlers.onView),
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      {dialogs}
    </>
  );
}
