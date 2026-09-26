"use client";

import * as React from "react";
import { CalendarCheck, CalendarDays, History, Inbox } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/states";
import { MeetingRow } from "@/components/teacher/meeting-row";
import { useTeacherMeetings } from "@/components/teacher/use-teacher-meetings";
import { useVisitActions, useVisitDialogs } from "@/components/admin/visit-actions";
import type { Meeting } from "@/lib/types";
import { formatDate, todayISO } from "@/lib/utils";

/**
 * The teacher's full meeting book.
 *
 * Approve, reject, reschedule, start and complete all go through the same API
 * the console uses, so the server applies one set of rules regardless of which
 * portal the decision came from.
 */
export default function TeacherMeetingsPage() {
  const actions = useVisitActions();
  const { handlers, dialogs } = useVisitDialogs();
  const { requests, todays, upcoming, history, act } = useTeacherMeetings();

  const today = todayISO();

  const renderList = (list: Meeting[], emptyTitle: string, emptyText: string) =>
    list.length === 0 ? (
      <EmptyState icon={Inbox} title={emptyTitle} description={emptyText} />
    ) : (
      <ul className="divide-y divide-border">
        {list.map((meeting) => (
          <MeetingRow
            key={meeting.id}
            meeting={meeting}
            actions={{
              onApprove: () => act(meeting, (record) => actions.approve(record)),
              onReject: () => act(meeting, handlers.onReject),
              onReschedule: () => act(meeting, handlers.onReschedule),
              onStart: () => act(meeting, (record) => actions.startMeeting(record)),
              onComplete: () => act(meeting, (record) => actions.completeMeeting(record)),
              onView: () => act(meeting, handlers.onView),
            }}
          />
        ))}
      </ul>
    );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Meeting requests"
          value={requests.length}
          icon={Inbox}
          tone={requests.length > 0 ? "warning" : "default"}
        />
        <StatCard label="Today" value={todays.length} icon={CalendarCheck} tone="accent" />
        <StatCard label="Upcoming" value={upcoming.length} icon={CalendarDays} />
        <StatCard label="Past meetings" value={history.length} icon={History} tone="success" />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            Requests
            {requests.length > 0 ? (
              <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">
                {requests.length}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="requests">
          <Card>
            <SectionHeader
              title="Meeting requests"
              description="Visitors waiting for your approval"
            />
            {renderList(
              requests,
              "No pending requests",
              "Visitor requests addressed to you will appear here for approval.",
            )}
          </Card>
        </TabsContent>

        <TabsContent value="today">
          <Card>
            <SectionHeader title="Today's meetings" description={formatDate(today)} />
            {renderList(
              todays,
              "Nothing scheduled today",
              "Meetings booked for today will be listed here.",
            )}
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <SectionHeader title="Upcoming meetings" description="Scheduled for later dates" />
            {renderList(
              upcoming,
              "No upcoming meetings",
              "Approved and pending visits for future dates appear here.",
            )}
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <SectionHeader title="Meeting history" description="Completed and closed meetings" />
            {renderList(
              history,
              "No past meetings",
              "Once meetings are completed they are archived here.",
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {dialogs}
    </>
  );
}
