"use client";

import * as React from "react";
import { CalendarClock, Check, Clock, Eye, Play, Square, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MeetingStatusBadge } from "@/components/shared/status-badge";
import { VisitorPhotoThumb } from "@/components/shared/visitor-photo";
import type { Meeting } from "@/lib/types";
import { formatDate, formatTime } from "@/lib/utils";

/**
 * One meeting in a teacher's list.
 *
 * Which buttons appear is driven by the meeting's own status, so a teacher is
 * never offered an action the server would refuse — approving a meeting that
 * has already started, for instance.
 */
export interface MeetingRowActions {
  onApprove?: () => void;
  onReject?: () => void;
  onReschedule?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
  onView?: () => void;
}

export function MeetingRow({
  meeting,
  actions,
}: {
  meeting: Meeting;
  actions: MeetingRowActions;
}) {
  // `meetingStatus` is the teacher-facing vocabulary; `status` is the booking's
  // own lifecycle, which is what decides whether a gate-side action is possible.
  const pending = meeting.meetingStatus === "Requested";
  const canStart = meeting.status === "Checked In";
  const canComplete = meeting.status === "Meeting In Progress";

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3 sm:w-40 sm:shrink-0">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary"
          aria-hidden
        >
          <Clock className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold tabular-nums">{formatTime(meeting.time)}</p>
          <p className="text-xs text-muted-foreground">{formatDate(meeting.date)}</p>
        </div>
      </div>

      {/* The face the host should expect at their door. */}
      <VisitorPhotoThumb
        photoUrl={meeting.visitorPhotoUrl}
        name={meeting.visitorName}
        size="md"
        className="hidden sm:flex"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{meeting.visitorName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {meeting.visitorMobile} · {meeting.department}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <Badge variant="secondary" size="sm">
            {meeting.purpose}
          </Badge>
          <Badge variant="outline" size="sm">
            {meeting.duration}
          </Badge>
          <MeetingStatusBadge status={meeting.meetingStatus} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        {pending && actions.onApprove ? (
          <Button size="sm" variant="success" onClick={actions.onApprove}>
            <Check className="h-3.5 w-3.5" />
            Approve
          </Button>
        ) : null}

        {pending && actions.onReject ? (
          <Button size="sm" variant="outline" onClick={actions.onReject}>
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        ) : null}

        {actions.onReschedule && ["Requested", "Approved"].includes(meeting.meetingStatus) ? (
          <Button size="sm" variant="outline" onClick={actions.onReschedule}>
            <CalendarClock className="h-3.5 w-3.5" />
            Reschedule
          </Button>
        ) : null}

        {canStart && actions.onStart ? (
          <Button size="sm" onClick={actions.onStart}>
            <Play className="h-3.5 w-3.5" />
            Start
          </Button>
        ) : null}

        {canComplete && actions.onComplete ? (
          <Button size="sm" variant="success" onClick={actions.onComplete}>
            <Square className="h-3.5 w-3.5" />
            Complete
          </Button>
        ) : null}

        {actions.onView ? (
          <Button size="sm" variant="ghost" onClick={actions.onView}>
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
        ) : null}
      </div>
    </li>
  );
}
